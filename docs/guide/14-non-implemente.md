# 14 — Ce qui n'est pas encore construit : prévu au cahier des charges ou visible à l'écran

> Guide complet de l'application Event Village, état de `main` à `0889df6` (lots 1 à 9 ter). Source de vérité : le code,
> comparé au cahier des charges `docs/CDC-V3.md` (V3.0, cité « CDC §n »). Chemins relatifs au dépôt ; `M/` =
> `supabase/migrations/`. Ce qui n'a pas pu être établi est marqué **NON VÉRIFIÉ**.
>
> **D'où vient le « lot prévu ».** Le code ne contient aucun plan de lots. Les lots cités ici viennent : de la consigne de
> ce guide (salles lot 10, tables lot 11, commandes lot 12, monétisation et parrainage complet lot 13) ; des décisions
> écrites du cahier de recette (`docs/recette-billetterie.md:244`, `:292-297`) ; des renvois du rapport du lot 9 bis
> (`docs/lot9bis-rapport.md:120-172` : lot 13 et lot 14). Un point sans lot désigné dans ces documents est marqué
> « aucun lot désigné ».
>
> Les pages des services fermés, menu par menu, sont aussi dans `01-roles-menus-ecrans.md` (01.13) ; l'abonnement et
> l'essai côté partenaire dans `03-partenaire.md` (03.12, 03.14) ; le parrainage dans `09-parrainage.md` (09.14) ;
> ce qu'aucun écran d'administration ne permet dans `11-admin-superadmin.md` (11.20). Écarts relevés : `15-constats.md`
> (W7-xx).

## Sommaire

| N° | Sujet | Lot prévu |
|---|---|---|
| 14.1 | Les interrupteurs `features.*` : ce qu'ils ouvrent et ce qu'ils ferment | — |
| 14.2 | Salles de fête | lot 10 |
| 14.3 | Réservation de tables | lot 11 |
| 14.4 | Commandes, produits et menus | lot 12 |
| 14.5 | Abonnement, offres et période d'essai | lot 13 (monétisation) |
| 14.6 | Mise en avant sponsorisée, promotion | lot 13 (monétisation) |
| 14.7 | Moyens de paiement non construits (Free Money, Wizall, Kpay, carte) et hors plateforme autre que les espèces | aucun lot désigné |
| 14.8 | Retrait par virement bancaire | aucun lot désigné |
| 14.9 | Parrainage complet (prestataires, personnalisation, suivi) | lot 13 |
| 14.10 | Campagnes de communication, WhatsApp | lot des communications ; WhatsApp : lot 13, hors V1 |
| 14.11 | Liste d'attente, codes promo | aucun lot désigné |
| 14.12 | Manques de l'administration (listes, recherche de billet, écarts de caisse, journal, rôles) | lot 13 et lot 14 |
| 14.13 | Autres écarts au cahier des charges | selon le point |
| 14.14 | Tableau de correspondance : chaque partie du cahier des charges, son état, son lot | — |

---

## 14.1 Les interrupteurs `features.*` : ce qu'ils ouvrent et ce qu'ils ferment

1. **Qui, où.** SUPERADMIN, `/admin/finance-settings`, section « Fonctionnalités » (« Services proposés en plus de la
   billetterie. Un service désactivé n’est ni visible ni utilisable par les clients et les partenaires. ») : « Salles de
   fête », « Réservation de tables », « Commandes de repas » (`app/admin/finance-settings/page.tsx:95-97`, `:109`).
2. **Ce qu'il saisit.** « Activé » ou « Désactivé » et un motif (11.13). Valeur à l'installation : **Désactivé** pour les
   trois (`M/20261105000001_lot7_reglages.sql:34-38`).
3. **Ce que fait le système.** Les trois interrupteurs sont relus en base à **chaque** requête : la bascule vaut dès la
   requête suivante ; une valeur absente ou illisible vaut « fermé » ; une base injoignable est une erreur, jamais une
   ouverture silencieuse (`lib/features/flags.ts:1-19`, `:54-84`). Fermé :
   - les pages répondent la page « Erreur 404 » / « Page introuvable » / « Cette page n’existe pas ou n’est pas
     disponible. Vérifiez l’adresse, ou repartez de l’accueil. » (`app/halls/layout.tsx:11-15`, `app/not-found.tsx:16-27`) ;
   - les routes répondent 404 « Page introuvable. » (`lib/features/flags.ts:86-88`) : une vingtaine de routes gardées
     (salles, tables, restaurants, produits, commandes, et la création d'un paiement de salle, de table ou de commande,
     `app/api/payments/create/route.ts:13-19`, `:48-52`) ;
   - les entrées de menu disparaissent : client « Commandes » (si les trois sont fermés), « Salles de fête »,
     « Restaurants et tables » ; partenaire « Produits et menu », « Salles de fête », « Tables », « Commandes »
     (`components/layout/AppLayout.tsx:128-152`) ;
   - restent ouverts quoi qu'il arrive : statut, confirmation et annulation d'un paiement déjà lancé, tâches planifiées,
     supervision, statistiques et tableau de bord partenaire (`lib/features/flags.ts:17-18`). Rien n'est supprimé : ni
     pages, ni données.
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** L'administration garde une lecture de ces services dans « Catalogues et
   services » : onglets « Salles de fête », « Restaurants et tables », « Produits et traiteurs », « Commandes », avec
   « Service désactivé » / « Ce service est fermé par son interrupteur : il est masqué au public. Les données restent
   consultables ici. » (`app/admin/services/page.tsx:30-36`, `:298-312`).
6. **Ce qui est impossible.** Aucun autre rôle que le SUPERADMIN ne change un interrupteur depuis un écran (une route
   d'administration le permet sans écran : 11.12).
7. **Preuves et essai.** Fichiers cités. **NON VÉRIFIÉ** : état actuel des trois interrupteurs sur event-village-dev.

## 14.2 Salles de fête (lot 10)

1. **Prévu (CDC §42 à §48, §113, §139, §146, §187).** Catalogue de salles (localisation, date, prix, capacité,
   disponibilité), réservation avec paiement intégral, acompte ou paiement différé, moratoire (« MORATOIRE EXPIRÉ »),
   annulation selon les conditions du partenaire ; commission et frais de service.
2. **À l'écran aujourd'hui.** Interrupteur fermé : `/halls`, `/halls/{id}` et `/partner/halls` répondent « Page
   introuvable », aucun menu (14.1). Interrupteur ouvert : un code ancien, antérieur aux lots de la billetterie,
   s'affiche (titre partenaire « Reservation de Salles », sans accent) (`app/partner/halls/page.tsx:202-205`, 01.13).
3. **Ce que fait le code.** Des écrans et des routes existent (liste et fiche publiques, réservation `POST /api/halls/reserve`,
   gestion partenaire, statut d'une réservation) (`app/halls/page.tsx:27`, `app/halls/[id]/page.tsx:51`, `:118`,
   `app/partner/halls/page.tsx:70-142`) ; un paiement de réservation sait encaisser l'acompte ou le solde
   (`lib/payments/payment.service.ts:86-112`) ; la tâche des moratoires expire les réservations échues
   (`app/api/cron/moratoriums/route.ts:20-37`, 12). Aucun de ces écrans n'a été repris ni recetté par les lots 1 à 9 ter
   (`docs/recette-billetterie.md:112`, ligne « §42 à §73 » : « hors périmètre »). **NON VÉRIFIÉ** : fonctionnement réel
   de ce code une fois l'interrupteur ouvert.
4. **Messages.** Le catalogue contient trois types de salle, cloche et email : `HALL_RESERVATION_REQUESTED` (« Demande
   de réservation de salle », à la partenaire), `HALL_RESERVATION_CONFIRMED` (« Réservation de salle confirmée », au
   client), `HALL_RESERVATION_CANCELLED` (« Réservation de salle annulée ») (`lib/notifications/catalog.ts:1069-1095`) ;
   et `PAYMENT_SUCCESS` « Paiement confirmé » / « Votre paiement de {montant} a été validé. » (lien `/orders`) pour un
   paiement de service (`:1063-1068`). Textes complets : `10-notifications.md`. **NON VÉRIFIÉ** en exécution.
5. **Autres rôles.** Administration : onglet « Salles de fête » de « Catalogues et services », en lecture.
6. **Impossible aujourd'hui.** Réserver une salle (interrupteur fermé par défaut).
7. **Lot prévu.** Lot 10 (consigne du guide).

## 14.3 Réservation de tables (lot 11)

1. **Prévu (CDC §49 à §55, §112).** Zones, tables, capacité, horaires, disponibilité, acompte, paiement hors plateforme
   enregistré mais non compté comme encaissement Event Village ; réservation de tables d'un événement (§34, §51).
2. **À l'écran aujourd'hui.** Fermé : « Page introuvable » pour `/restaurants/{id}/tables` et `/partner/tables`.
   Ouvert : le menu client « Restaurants et tables » mène toujours au même restaurant d'exemple
   (`/restaurants/rest-terrou-bi/tables`, `components/layout/AppLayout.tsx:140`) ; partenaire « Tables & Zones »
   (`app/partner/tables/page.tsx:364-367`).
3. **Ce que fait le code.** Routes de zones, tables et réservations côté partenaire, réservation côté client
   (`app/partner/tables/page.tsx:117-134`, `app/restaurants/[id]/tables/page.tsx:47`, `:82`), paiement de l'acompte
   (`lib/payments/payment.service.ts:114-130`). Non repris par les lots ; **NON VÉRIFIÉ** une fois ouvert. Les tables
   d'un **événement** (§34, §51) n'existent pas : la tâche 5.9 a limité les services d'un événement à la billetterie
   (`docs/recette-billetterie.md:94`, ligne « §34 » : « écarté »).
4. **Messages.** Aucun type propre aux tables dans le catalogue (recherche de `TABLE` dans
   `lib/notifications/catalog.ts`) ; un paiement d'acompte confirmé relève de `PAYMENT_SUCCESS` (14.2).
5. **Autres rôles.** Administration : onglet « Restaurants et tables », en lecture.
6. **Impossible aujourd'hui.** Réserver une table.
7. **Lot prévu.** Lot 11 (consigne du guide).

## 14.4 Commandes, produits et menus (lot 12)

1. **Prévu (CDC §56 à §73, §114, §140, §141, §147, §159, §186).** Catalogue de produits et plats du jour, panier,
   paiement intégral, acompte ou différé, livraison, retrait, sur place, produits interdits (alcool), annulation,
   statistiques.
2. **À l'écran aujourd'hui.** Fermé : « Page introuvable » pour `/orders` (si les trois services sont fermés),
   `/restaurants/{id}/menu`, `/partner/products`, `/partner/orders` (`app/orders/layout.tsx:13-16`). Ouvert : « Mes
   commandes et réservations » (client, `app/orders/page.tsx:169`), « Menu & Commande Traiteur — {restaurant} »
   (`app/restaurants/[id]/menu/page.tsx:145-147`), « Produits & Menu » et « Commandes » (partenaire, 01.13).
3. **Ce que fait le code.** Création d'une commande (`POST /api/orders/create`), suivi partenaire filtré par les statuts
   `EN_ATTENTE`, `EN_PREPARATION`, `PRETE`, `EN_LIVRAISON`, `LIVREE`, `ANNULEE` (codes de
   `app/partner/orders/page.tsx:84` ; libellés affichés NON VÉRIFIÉS), refus du paiement en ligne d'une commande qui contient un produit suspendu ou
   indisponible : « Paiement en ligne refusé : La commande contient des produits interdits ou indisponibles à la vente
   en ligne. » (`lib/payments/payment.service.ts:69-75`). Non repris par les lots ; **NON VÉRIFIÉ** une fois ouvert.
4. **Messages.** Aucun type propre aux commandes de repas : `NEW_ORDER` (« Nouvelle commande ») annonce en réalité une
   **vente de billets** à la partenaire (« {n} billets vendus pour « {titre} » ({total}). »,
   `lib/notifications/catalog.ts:943-951`) ; un paiement de commande confirmé relève de `PAYMENT_SUCCESS` (14.2).
   **NON VÉRIFIÉ** en exécution.
5. **Autres rôles.** Administration : onglets « Produits et traiteurs » et « Commandes », en lecture.
6. **Impossible aujourd'hui.** Commander un repas.
7. **Lot prévu.** Lot 12 (consigne du guide).

## 14.5 Abonnement, offres et période d'essai (lot 13, monétisation)

1. **Prévu (CDC §25 à §27, §110, Annexe D).** 60 jours d'essai (Founders 90) ; offres Starter 2 500 F/mois ou 7 500 F/
   trimestre, Business 5 000 F ou 15 000 F, Premium 10 000 F ou 30 000 F, avec des droits différents.
2. **À l'écran aujourd'hui.** Partenaire, menu « Abonnement » `/partner/subscription` : lecture seule (textes exacts en
   03.14) ; « Aucune offre attribuée : vous utilisez la plateforme pendant votre période d’essai. » ; sans offre en base :
   « Aucune offre n’est encore publiée » / « Les offres d’abonnement Event Village apparaîtront ici dès leur
   publication. » ; avec des offres : « Le changement d’offre se fait avec l’équipe Event Village : il n’est pas encore
   possible en ligne. » et « Contacter le support » (`app/partner/subscription/page.tsx:183`, `:192-193`, `:231`).
   Tableau de bord : « Période d’essai gratuite en cours » (03.12).
3. **Ce que fait le code.**
   - Essai : démarré à la première visite du tableau de bord, 60 jours, ou 90 pour une fiche « fondateur » ; **aucun
     effet** (rien ne lit sa date de fin, aucun rappel), et aucun écran ne marque une fiche « fondateur » (03.12).
   - Offres : aucune migration n'en crée ; la base locale de démonstration en crée trois à des prix contraires au cahier
     des charges (« Pack Starter » 0 F, « Pack Business » 25 000 F, « Pack Premium » 50 000 F par mois,
     `supabase/seed.sql:8-39`, constat W7-14) ; aucun écran d'administration ne publie d'offre (11.20).
   - Paiement d'un abonnement : le serveur sait l'encaisser (fiche validée seulement : « Abonnement réservé aux comptes
     partenaires validés. ») et poser son échéance, sans frais de service, entièrement pour Event Village ; **aucun écran
     n'y mène** (`lib/payments/payment.service.ts:138-160`, 03.14, 06.21).
   - Aucune limite d'offre (nombre d'événements, de produits) n'est appliquée : les limites ne servent qu'à l'affichage
     (« Événements illimités », « Jusqu’à {n} événements ») (`app/api/partner/subscription/route.ts:44-80`).
4. **Messages.** `TRIAL_STARTED` au démarrage de l'essai (03.12) ; `SUBSCRIPTION_ACTIVATED` n'est atteignable que par ce
   paiement sans écran (03.14).
5. **Autres rôles.** Administration : aucune gestion d'abonnement (CDC §129 « abonnement » : non construit).
6. **Impossible aujourd'hui.** Souscrire, changer d'offre, voir une offre publiée par Event Village, limiter un
   partenaire selon son offre, faire expirer un essai.
7. **Lot prévu.** Lot 13 (monétisation ; point R56 « renvoyé au lot 13 », `docs/lot9bis-rapport.md:120`,
   `docs/parcours-evenement-complet.md:4223`).

## 14.6 Mise en avant sponsorisée, promotion (lot 13, monétisation)

1. **Prévu (CDC §107, §116, Annexe E).** Mise en avant, homepage, position prioritaire, contenu sponsorisé, payants.
2. **À l'écran aujourd'hui.** Aucun bouton de demande côté partenaire, aucun écran côté administration.
3. **Ce que fait le code.** Toute demande de la partenaire est refusée : « La mise en avant sponsorisée n’est pas proposée
   pour le moment : seule la billetterie est disponible. » (`app/api/partner/events/[id]/promotion/route.ts:13-20`) ; la
   route d'administration qui approuve ou refuse une demande et pose la mise en avant de l'événement existe sans écran
   (`app/api/admin/promotions/route.ts:8-90` ; constat W7-15). « Populaires » de l'accueil repose sur les ventes des 7
   derniers jours, pas sur un paiement (`docs/recette-billetterie.md:70`).
4. **Messages.** Aucun.
5. **Autres rôles.** Aucun.
6. **Impossible aujourd'hui.** Acheter ou accorder une mise en avant depuis un écran.
7. **Lot prévu.** Lot 13 (monétisation, consigne du guide). Décision de retrait au lot 5 : tâche 5.9.

## 14.7 Moyens de paiement non construits ; hors plateforme autre que les espèces

1. **Prévu (CDC §1, §38, §76, §77, §144).** « Moyens de paiement intégrés », frais d'agrégateur configurables par moyen ;
   hors plateforme : « espèces ; Wave direct ; Orange Money direct ; autre moyen ».
2. **À l'écran aujourd'hui.** La fenêtre « Paiement sécurisé » ne propose que **Wave** et **Orange Money** (06.6) ;
   le guichet n'encaisse que des **espèces** (05).
3. **Ce que fait le code.**

   | Moyen | État | Preuve |
   |---|---|---|
   | Wave, Orange Money (par SamirPay) | construits | `lib/samirpay/types.ts:7-8` |
   | Free Money | absent ; seule trace : un taux de 1,5 % dans une clé de réglage ancienne lue par aucun calcul | `M/0007_superadmin_complete.sql:37-42` ; 11.13 (clés anciennes) |
   | Wizall, Kpay | absents (aucune occurrence dans `app/`, `components/`, `lib/`, `supabase/migrations/`) | recherche « wizall », « kpay » |
   | Carte bancaire | retirée au lot 2 « tant qu'elle n'est pas intégrée » ; trace dans la même clé ancienne (2,5 % + 100 F) | `lib/validations/payment.ts:22-26` ; `M/0007_superadmin_complete.sql:41` |
   | Hors plateforme : espèces au guichet | construit (vente au guichet, caisse) | `M/20261110000009_lot9ter_zones.sql:1586-1592` |
   | Hors plateforme : Wave direct, Orange Money direct, autre | valeurs prévues dans la base (`WAVE_DIRECT`, `OM_DIRECT`, `AUTRE`), jamais utilisées : toute vente hors plateforme est enregistrée « ESPECES » | `M/0001_initial_schema.sql:96-101` ; recherche de `WAVE_DIRECT` dans `app/`, `lib/` sans résultat |

   Réglages : seuls les frais agrégateur Wave et Orange Money existent (08.21).
4. **Messages.** Sans objet.
5. **Autres rôles.** Sans objet.
6. **Impossible aujourd'hui.** Payer avec Free Money, Wizall, Kpay ou une carte ; enregistrer une vente hors plateforme
   réglée par Wave ou Orange Money direct.
7. **Lot prévu.** Aucun lot désigné dans les documents du dépôt (carte : « retirée tant qu'elle n'est pas intégrée »,
   `docs/recette-billetterie.md:103`, ligne « §38 »).

## 14.8 Retrait par virement bancaire

1. **Prévu (CDC §83, §105, §118).** Retraits « Mobile Money ; banque ».
2. **À l'écran aujourd'hui.** « Demander un retrait » ne propose que Wave et Orange Money (03.19) ; le réglage
   « Retraits par virement bancaire » est **Désactivé** (aide : « Tant qu’il est désactivé, seuls Wave et Orange Money
   sont proposés. ») (`app/admin/finance-settings/page.tsx:75`).
3. **Ce que fait le code.** La base sait enregistrer un retrait bancaire si le réglage est activé (statut « en attente »,
   aucun versement créé), sinon : « Les retraits par virement bancaire ne sont pas ouverts. »
   (`M/20261109000006_lot9bis_argent.sql:681-683`, `:733-740`, `:750-764`). Aucun écran ne saisit des coordonnées
   bancaires, aucun écran d'administration ne traite un retrait en attente : activer le réglage ne suffit pas.
4. **Messages.** Aucun.
5. **Autres rôles.** Aucun.
6. **Impossible aujourd'hui.** Retirer vers une banque.
7. **Lot prévu.** Aucun lot désigné (point A10 du cahier de recette, `docs/recette-billetterie.md:123`, `:143`, `:249`).

## 14.9 Parrainage complet (lot 13)

1. **Prévu (CDC §87, §88, §96 à §99, §101, §104, §106, §119, §132, §133, §162, Annexe A).** Lien « Inviter un
   prestataire » distinct, grille prestataire (7/2 % sur 24 mois ; Ambassadeur 10/3 % sur 36 mois), personnalisation des
   taux et durées par le SUPERADMIN avec historique, historique complet du parrainage, ROI, écrans d'administration des
   commissions et des ambassadeurs.
2. **À l'écran aujourd'hui.** `/admin/referral` : « La personnalisation des taux n’est pas disponible pour le moment. »
   (`app/admin/referral/page.tsx:233`) ; aucun lien « prestataire » dans le Portefeuille (09).
3. **Ce que fait le code.** Liste détaillée en 09.14 : lignes de grille prestataire présentes en base mais jamais
   utilisées ; aucune personnalisation ; aucune liste des commissions, des retraits de parrainage ni des gains par
   ambassadeur ; aucun avis au parrain ; rien contre la fraude par transactions artificielles ni les rétrofacturations
   (`docs/recette-billetterie.md:139`, `:142` ; ce dernier point sans lot désigné).
4. **Messages.** Aucun message propre au parrainage (09.13).
5. **Autres rôles.** Sans objet.
6. **Impossible aujourd'hui.** Parrainer un prestataire ; modifier un taux ; lire le ROI.
7. **Lot prévu.** Lot 13 (`docs/recette-billetterie.md:244`, `:292`, `:295`, `:297`).

## 14.10 Campagnes de communication, WhatsApp

1. **Prévu (CDC §22, §70, §117, §120 à §126, §150).** Campagnes vers clients et partenaires, par SMS, WhatsApp, email,
   push, avec tarification (coût, tarif, marge).
2. **À l'écran aujourd'hui.** `/admin/communications` : bandeau « Envoi des campagnes désactivé » / « L’envoi aux
   destinataires sera ouvert avec le lot des communications (préférences et désabonnement). En attendant, chaque campagne
   reste un brouillon. » (`app/admin/communications/page.tsx:218-220` ; détail en 11.15).
3. **Ce que fait le code.** Une campagne est enregistrée en brouillon, rien ne part (11.15). Les canaux de notification
   sont cloche, SMS, email et push : **pas de WhatsApp** (`lib/notifications/catalog-types.ts:40`). La tarification des
   communications n'existe que comme clé ancienne de réglage, lue par aucun calcul (`M/0007_superadmin_complete.sql:43-44`, 11.13).
4. **Messages.** Aucun envoi de campagne.
5. **Autres rôles.** Aucun.
6. **Impossible aujourd'hui.** Envoyer une campagne ; recevoir un message WhatsApp.
7. **Lot prévu.** Campagnes : « le lot des communications » (texte de l'écran ; numéro de lot non désigné). WhatsApp :
   renvoyé au lot 13, hors de la V1 (R82, `docs/lot9bis-rapport.md:146`).

## 14.11 Liste d'attente, codes promo

1. **Prévu.** Ni la liste d'attente d'une catégorie complète, ni les codes promo ne figurent au cahier des charges
   (recherche dans `docs/CDC-V3.md`) ; ils sont cités par la consigne de ce guide.
2. **À l'écran aujourd'hui.** Une catégorie épuisée affiche « Complet » (06.1, 06.2), sans inscription possible ; le
   panier n'a aucun champ de code.
3. **Ce que fait le code.** Rien : aucune occurrence de « waitlist », « liste d’attente », « code promo », « coupon » ou
   « discount » dans `app/`, `components/`, `lib/` et `supabase/migrations/`. Le prix d'un billet est toujours le prix de
   sa catégorie (devis du serveur, 06.3).
4. **Messages.** Aucun.
5. **Autres rôles.** Aucun.
6. **Impossible aujourd'hui.** S'inscrire sur une liste d'attente ; appliquer une réduction.
7. **Lot prévu.** Aucun lot désigné.

## 14.12 Manques de l'administration

| Besoin (CDC) | État aujourd'hui | Lot prévu | Preuve |
|---|---|---|---|
| Liste des retraits et des commissions (§131, §132) | absente : seulement le total « Retraits versés » et « Versements à reprendre » (08.11, 08.20) | lot 13 | R65, `docs/parcours-evenement-complet.md:4232` |
| Retrouver un billet par son numéro ou son client (§130) | absent : seul le pilotage d'un événement le permet (08.4) | lot 14 | R68, `docs/lot9bis-rapport.md:132` |
| Écarts de caisse consolidés, tous partenaires | route sans écran (« Consulter les écarts de caisse ») | lot 14 | R99, `app/api/admin/shifts/audit/route.ts:8` ; 11.20 |
| Journal d'audit complet (pagination, libellés, champ « statut », §134) | partiel (100 lignes) | lot 14 | R64, `docs/lot9bis-rapport.md:128` ; 11.17 |
| Changer les rôles d'un compte existant | route sans écran | aucun lot désigné | 11.20 |
| Publier des offres d'abonnement, gérer les mises en avant | absent | lot 13 | 14.5, 14.6 |
| Statistiques et ROI du parrainage (§119, §162) | absent | lot 13 | 14.9 |

## 14.13 Autres écarts au cahier des charges

| Point (CDC) | État aujourd'hui | Lot prévu | Preuve |
|---|---|---|---|
| Un client connecté devient partenaire avec le même compte (§1, §6 P1, §183) | impossible : l'inscription partenaire crée un compte distinct | lot 13 | R83, `docs/lot9bis-rapport.md:147` ; `docs/recette-billetterie.md:52` |
| Page publique de la partenaire (§28, « Page professionnelle ») | la page « Page professionnelle » se remplit, mais aucune page publique ne l'affiche (aucune route publique de partenaire dans `app/`) | lot 13 | R108, `docs/lot9bis-rapport.md:172` ; `app/partner/profile/page.tsx:160-161` |
| Application mobile (§188) | application web installable (manifeste, service worker) ; aucun projet d'application native dans le dépôt | aucun lot désigné | `public/manifest.json`, `public/sw.js` ; racine du dépôt sans dossier Android ou iOS |
| Contact de l'organisateur sur la fiche (§33) | partiel | aucun lot désigné | `docs/recette-billetterie.md:93` (A15) |
| Fraude et rétrofacturation (§101) | aucun mécanisme | aucun lot désigné | `docs/recette-billetterie.md:139` |
| « Revenu final » par paiement (§142) | seulement en total (« Revenu net après parrainage », 08.20) | aucun lot désigné | `docs/recette-billetterie.md:172` |
| Services associés d'un événement (§34 : tables, communication, promotion) | billetterie seule (décision du lot 5) | 11 (tables), 13 (promotion), déduit de la consigne | `docs/recette-billetterie.md:94` |
| Verrou de connexion côté serveur | navigateur seulement | lot 14 | R89, `docs/lot9bis-rapport.md:153` |

## 14.14 Tableau de correspondance : cahier des charges, état, lot

État : « construit » = présent dans le code de la billetterie et décrit dans ce guide ; « partiel » ; « fermé » = code
présent derrière un interrupteur fermé, non repris ; « absent ».

| Partie du CDC | § | État | Où dans ce guide | Lot prévu |
|---|---|---|---|---|
| I, II Vision, rôles | 1 à 13 | construit (sauf « un compte, plusieurs services » : 14.13) | 01, 11 | 13 pour le compte unique |
| III Compte client | 14 à 22 | construit ; réservations et commandes fermées ; WhatsApp absent | 02, 06, 07, 10 | 10 à 12 ; 13 (WhatsApp) |
| IV Espace partenaire | 23 à 29 | inscription, validation construites ; essai sans effet ; offres absentes ; page publique absente | 03, 14.5, 14.13 | 13 |
| V Événements | 30 à 34 | construit ; services associés réduits à la billetterie | 04 | — |
| VI Ticketing | 35 à 41 | construit | 04 à 08 | — |
| VII Salles | 42 à 48 | fermé | 14.2 | 10 |
| VIII Tables | 49 à 55 | fermé | 14.3 | 11 |
| IX Commandes | 56 à 73 | fermé | 14.4 | 12 |
| X Paiements et finances | 74 à 84 | construit pour Wave et Orange Money ; banque absente ; hors plateforme limité aux espèces | 06, 08, 14.7, 14.8 | aucun lot désigné |
| XI Parrainage | 85 à 106 | client standard et Ambassadeur client construits ; prestataire, personnalisation, ROI absents | 09, 14.9 | 13 |
| XII Modèle économique | 107 à 119 | frais de service et frais de retrait construits ; abonnements, promotion, communication payante absents | 08, 14.5, 14.6, 14.10 | 13 |
| XIII Communication | 120 à 126 | brouillons seulement | 11.15, 14.10 | lot des communications |
| XIV Administration | 127 à 134 | partiel (listes, recherche de billet, journal) | 11, 14.12 | 13, 14 |
| XV Données et API | 135 à 144 | billetterie construite ; salles, tables, commandes fermées ; WhatsApp absent | — | 10 à 13 |
| XVI Automatisation | 145 à 150 | billetterie construite (12) ; réservations et commandes fermées ; campagnes absentes | 12 | 10 à 12 |
| XVII Sécurité | 151 à 156 | construit (mot de passe redemandé pour les actions sensibles, 02) | 02, 13 | 14 (verrou de connexion) |
| XVIII Statistiques | 157 à 163 | partiel (billetterie) | 03, 11 | 13 |
| XIX à XXIII Chronogramme, architecture, règles, livrables | — | pas d'exigence vérifiable dans le code, sauf l'application mobile (14.13) | — | — |

Statuts détaillés paragraphe par paragraphe, avec leurs tests : `docs/recette-billetterie.md:46-200` (matrice de
traçabilité ; les preuves de ce guide priment en cas d'écart).

---

## NON VÉRIFIÉ (récapitulatif)

- Fonctionnement des écrans de salles, tables et commandes une fois leur interrupteur ouvert (code ancien, jamais recetté).
- État des interrupteurs `features.*` et présence d'offres d'abonnement sur event-village-dev.
- Messages éventuels des services fermés au-delà de la recherche dans le catalogue des notifications.
- Lot prévu pour les moyens de paiement, la banque, la liste d'attente, les codes promo et l'application native : aucun
  document du dépôt ne le désigne.
