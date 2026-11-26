# Contre-vérification du lot 11c-b — tables d'un événement : écrans du client

Branche auditée : `origin/lot11c/tables-client` à `b7d128f10e` (rapport `docs/lot11c-b-rapport.md`). Tests de l'audit sur
`lot11c/cv-rouges-b` (partie de `b7d128f10e`, **jamais fusionnée**) : `tests/audit/cv11cb-1-trous.test.ts`,
`cv11cb-2-gardes.test.ts`, `cv11cb-3-statique.test.ts`. Aucun correctif appliqué, aucune migration, aucun appel au projet
distant, `.env.local` non lu, branche du lot et branche de la contre-vérification 11c-c non touchées.

## Verdict

**Livrable sous réserve de deux correctifs moyens (T1, T2), sans urgence de sécurité.** Quatre trous, aucun critique
ni élevé : rien ne laisse payer un autre montant, prendre une table tenue, lire la table d'un autre compte ou exposer
l'identifiant d'une vente à un invité. Les deux trous moyens touchent des promesses de l'écran : la « table prise en
direct » n'arrive jamais (T1), et un titulaire qui a envoyé toutes ses places perd l'accès à « Ma table », donc au
remboursement après un report (T2). Les deux faibles : prénoms des invités oubliés sur le téléphone après une session
close ailleurs (T3, avec la remarque du point 10 sur cvf2b-6) et un lien SMS qui pourrait ouvrir l'onglet (T4).
Les 10 points de la consigne ont été éprouvés ; les affirmations du rapport du lot sont exactes, sauf « table prise en
direct » (T1) et la raison donnée pour le SMS du rappel (T4).

| Trou | Gravité | Point | Résumé |
|---|---|---|---|
| T1 | Moyen | 7 (et décision 2 du lot) | « Table prise en direct » n'arrive jamais : un type de table n'a pas de tranche publique, la table tenue ou vendue ne produit aucun message temps réel ; le plan ouvert la garde « Libre » |
| T2 | Moyen | 4, 5 | Titulaire qui a envoyé toutes ses places : plus d'onglet « Tables » ni de « Gérer ma table » ; le remboursement au report, ouvert par le serveur, n'est plus atteignable depuis Mes billets |
| T3 | Faible | 6, 10 | Prénoms des invités gardés sur le téléphone après une session close à l'insu du navigateur (chemin cvf2b 6.5) ; correction de cvf2b-6 conforme à la lettre, pas à l'esprit |
| T4 | Faible | 8 | SMS du rappel « Vos invités attendent leurs places » vers `/tickets` alors que `/tickets?tab=tables` tient dans la marge (154 caractères au pire cas) |

Aucun trou critique ni élevé : aucun montant, aucune place, aucune donnée d'un autre compte ne sort ; le serveur refuse
tout ce que l'écran pourrait laisser passer (garde-fous G1 à G4 verts).

## Runs

Un seul run, rapide, de mes trois suites : **run 706** (`f6ed49ad37`, journaux `ci-results` :
`runs/706-45820502179/`). Typecheck et lint OK ; `cv11cb-2-gardes` **PASS** (7 tests) ; `cv11cb-1-trous` **FAIL** (T1, T2
rouges pour la raison visée) ; `cv11cb-3-statique` **FAIL** (T3, T4 rouges, 5 verts). Invariants des deux suites en base :
0 violation (lot 11c, paiements, finances, accès, cycle de vie, avis). Aucun run complet, aucune construction locale.

```
Suite                                  Statut   Durée     Code
tests/audit/cv11cb-1-trous.test.ts     FAIL     23.1s     1
tests/audit/cv11cb-2-gardes.test.ts    PASS     5.9s      0
tests/audit/cv11cb-3-statique.test.ts  FAIL     466ms     1
typecheck  OK     code 0   44 s
lint       OK     code 0   14 s
```

## Trous

### T1 — « Table prise en direct » : aucun signal (moyen)

**Constat.** L'onglet « Tables » ne relit l'offre que sur un message temps réel de `public_category_stock` filtré par
l'événement (`components/event-tables/client/TablesOffer.tsx:191-196`), le « signal temps réel existant du stock des
types » annoncé par le lot (`docs/lot11c-b-rapport.md:69`, essai n° 3 ligne 224) et par le lot 11c-a
(`lib/event-tables/event-tables.server.ts:233`). Or :

- un type de table est créé avec `sale_online = FALSE` (`supabase/migrations/20261201000003_l11c_configuration.sql:250`) ;
- `public_category_stock_sync` supprime la tranche de toute catégorie qui n'est pas vendue en ligne
  (`supabase/migrations/20261110000011_lot9ter_stock.sql:95-98`) : un type de table n'a **jamais** de ligne ;
- même avec une ligne, la tranche n'est réécrite que si elle change (`…lot9ter_stock.sql:115-120`) : au-dessus du seuil
  (10), une table prise ne changerait rien.

Une table tenue (attente de paiement) ou vendue ne produit donc aucun message : le plan ouvert la garde « Libre », sans
l'animation ni « La table 7 vient d'être prise ». La personne ne l'apprend qu'au devis (si elle touche cette table) ou au
refus de l'achat (`TABLE_TAKEN`). Aucun argent en jeu (le serveur refuse), mais la décision 2 de la consigne du lot n'est
pas tenue et aucun test du lot ne l'éprouvait (la suite `l11cb-ecrans` relit l'offre, le spec e2e ne garde pas deux
visiteurs).

**Preuve** (`cv11cb-1-trous`, T1) : abonnement anonyme identique à celui de l'onglet ; témoin de vivacité reçu (tranche de
la catégorie de billets) ; table tenue par un autre compte, offre « PRISE » ; 8 s plus tard, aucun message.

```
[CV11CB] T1. messages reçus après la mise en attente de la table 1 : 0 ; tranche publique du type : null ; type : {"sale_online":false,"kind":"TABLE","held_quantity":1}
not ok 1 - une table tenue puis vendue ne produit aucun message sur public_category_stock (abonnement de l’onglet « Tables »)
  error: 'aucun message temps réel après la mise en attente de la table 1 : l’onglet « Tables » ouvert ne relit jamais l’offre (tranche publique du type : null, type {"sale_online":false,"kind":"TABLE","held_quantity":1})'
```

**Correctif proposé.** Un signal public propre aux tables, sans volume : par exemple une table
`public_event_table_signal(event_id, version, updated_at)` tenue par trigger sur `stock_reservations` (lignes avec
`event_table_id`) et `event_table_bookings`, lisible par tous et publiée, que l'onglet écoute à la place (ou en plus) de
`public_category_stock`. Ne pas rendre la tranche des types publique : elle entrerait dans `public_event_state`
(`stock_level`, `min_price`) et ne bougerait de toute façon qu'au changement de tranche. En attendant, une relecture de
l'offre toutes les 15 s quand le plan est ouvert et l'onglet visible (sans migration). Test à ajouter : deux visiteurs,
message reçu dans les 5 s.

### T2 — Titulaire qui a envoyé toutes ses places : « Ma table » hors d'atteinte (moyen)

**Constat.** L'onglet « Tables » de Mes billets n'apparaît que si un billet du compte porte l'identifiant de la vente
(`app/tickets/TicketsView.tsx:409` et `:424`), et « Gérer ma table et mes invités » est sur la carte d'un billet du
titulaire. Rien n'empêche le titulaire d'envoyer **toutes** les places (le serveur l'accepte : places « à inviter » =
« à envoyer » − 1 n'est qu'un affichage). Dès que les invités ont accepté, le titulaire n'a plus aucun billet de la table :
plus d'onglet, plus de bouton, plus de suivi des invités. Après un report de plus de 24 h, le serveur ouvre bien le
remboursement de toute la table au titulaire (`event_table_mine` → `refund.open`), mais il n'est atteignable que par
l'ancien avis « Table réservée » de la cloche ou en tapant l'adresse.

**Preuve** (`cv11cb-1-trous`, T2) : table de 2 places, les 2 envoyées et acceptées, report de 48 h.

```
[CV11CB] T2. billets du titulaire pour l’événement : 0 ; avec la table : 0 ; onglet lié aux billets seulement : true ; remboursement : {"open":true,"until":"2026-12-08T12:36:23+00:00","amount":157500}
not ok 1 - places toutes envoyées et acceptées, report de 48 h : remboursement ouvert, mais aucun billet ne porte la table (onglet « Tables » caché)
  error: 'aucun billet du titulaire ne porte la table 9f62c4b4-6708-45fb-b544-725d959b3260 : onglet « Tables » et « Gérer ma table » absents de Mes billets, remboursement de 157500 F hors d’atteinte'
```

**Correctif proposé.** Un indicateur servi par `GET /api/tickets` après le contrôle de session (« le compte tient au
moins une table ACTIVE », une lecture de `event_table_bookings` par `holder_id`), que `TicketsView` ajoute à
`hasTables` ; le test T2 passe alors au vert (il accepte aussi tout autre moyen qui ne lie plus l'onglet aux seuls
billets). Envisager aussi de garder la place du titulaire (refuser l'envoi de la dernière place à envoyer), si le client
le souhaite.

### T3 — Prénoms des invités gardés après une session close à l'insu du navigateur (faible)

**Constat.** Les prénoms saisis à l'envoi d'une place sont gardés dans `localStorage` sous
`event-village:appareil:invites` (`lib/device/table-prefs.ts`), avec l'identifiant de chaque billet : donnée du compte
(prénoms, souvent lus dans le carnet du téléphone). Ils sont effacés au bouton « Se déconnecter » et sur `SIGNED_OUT`
(`clearDevicePrefs()`), mais pas sur le chemin cvf2b 6.5, « page chargée sans session (close à l'insu du navigateur :
Déconnecter tous mes appareils…) : tout ce que le compte a laissé sur l'appareil est effacé »
(`components/providers/AuthProvider.tsx:221-231`) : ce chemin n'appelle que `clearDevicePrefs('paiement')`, qui n'efface
que le numéro de paiement et les demandes des tables de restaurant (`lib/device/device-prefs-purge.ts:33`). C'est le
même défaut que la CV du lot 11b (T5, demandes particulières), corrigé alors en ajoutant la clé à la portée « paiement ».
Le compte suivant qui se connecte sur ce téléphone ne les voit pas à l'écran, mais ils restent lisibles sur l'appareil.

**Point 10 (esprit de cvf2b-6).** Le lot a fait passer `cvf2b-6` au vert sans la modifier, en écrivant par un accès
générique réexporté (`lib/device/device-prefs.ts:145`, `writeJson as writeDevicePref`) : la lettre est tenue (l'écrivain
est un fichier déjà classé, effacé au bouton), l'esprit non : le classement de `device-prefs.ts` dit toujours « opérateur
et numéro de paiement, recherches récentes », le détecteur d'écrivains ne voit plus `table-prefs.ts` (aucun `setItem`),
et n'importe quel module peut désormais écrire une clé de compte sans passer par la relecture que l'audit voulait
imposer ; la portée de la purge sans session n'a pas été revue.

**Preuve** (`cv11cb-3-statique`, T3, rouge en local et au run) :

```
[CV11CB] T3. purge du chemin sans session : clearDevicePrefs('paiement') ; clés avant ["event-village:appareil:invites","event-village:appareil:table-choisie:7c1d…","event-village:appareil:paiement"] ; après ["event-village:appareil:invites","event-village:appareil:table-choisie:7c1d…"] ; accès générique réexporté : true ; table-prefs.ts vu par le détecteur d’écrivains de cvf2b-6 : false ; classement de device-prefs.ts : « opérateur et numéro de paiement, recherches récentes de l’appareil (localStorage) »
not ok 1 - page chargée sans session : les prénoms des invités (donnée du compte) sont effacés comme le numéro de paiement
  AssertionError: prénoms des invités gardés après une session close à l’insu du navigateur : {"5b0e2f7a-…":"Fatou Ndiaye"}
  + [ 'event-village:appareil:invites' ]
  - []
```

**Correctif proposé.** Dans `device-prefs-purge.ts` (module sans dépendance), une constante pour la clé des prénoms
ajoutée à la portée `'paiement'` ; mettre à jour le classement de `device-prefs.ts` dans `cvf2b-6` (prénoms des invités,
table choisie) ; ne plus réexporter un écrivain générique (deux fonctions nommées, ou `table-prefs.ts` classé à part).

### T4 — SMS du rappel des places sans l'onglet « Tables » (faible)

**Constat.** `EVENT_TABLE_SEATS_REMINDER` et `EVENT_TABLE_CONFIRMED` mènent à « Ma table » dans la cloche, la notification
du téléphone et l'email, mais leurs SMS gardent `/tickets` (onglet « À venir »). Le lot le justifie dans
`docs/apres-lancement.md:211` par la longueur. Mesure au pire cas (titre long, table 999, 98 places, lien de 27
caractères) : la confirmation passerait à 157 caractères (au-delà de la marge de 155, justifié), mais **le rappel tiendrait
à 154** : la raison donnée ne vaut pas pour lui (`lib/notifications/catalog.ts:1657`).

```
[CV11CB] T4. rappel au pire cas avec l’onglet : GSM7 154 caractères (lien actuel : 143) — Event Village : il vous reste 98 places à envoyer pour la table 999, Nuit blanche " Prestige " à... demain. https://app.eventvillage.sn/tickets
[CV11CB] G-S. confirmation au pire cas avec l’onglet : 157 caractères ; actuel 146
not ok 1 - EVENT_TABLE_SEATS_REMINDER : le SMS ouvre l’onglet « Tables » quand le lien tient dans 155 caractères au pire cas
  error: 'SMS du rappel vers /tickets (onglet « À venir ») alors que /tickets?tab=tables tient (154 ≤ 155)'
ok 2 - EVENT_TABLE_CONFIRMED : l’écart du lien SMS est justifié (avec l’onglet, plus de 155 caractères au pire cas)
```

**Correctif proposé.** `appLink(ctx, '/tickets?tab=tables')` dans le SMS du rappel ; corriger la ligne de
`apres-lancement` (seule la confirmation garde `/tickets`).

## Garde-fous verts

Tous verts au run 706 (`cv11cb-2-gardes`, base locale ; `cv11cb-3-statique`, sans base).

| Garde | Point | Ce qui est prouvé |
|---|---|---|
| G1 a | 1 | Corps forgé (`amount`, `price`, `total`, `seats`) : 400 `INVALID_INPUT`, aucun paiement. Prix changé entre devis et achat : `[CV11CB] G1. devis 157500 F, prix changé, paiement demandé 210000 F (= 200000 + 10000)`. Numéro non vérifié : 403 `PHONE_NOT_VERIFIED` par la route (pas seulement l'écran), aucun paiement |
| G1 b | 1 | Double clic (même clé, simultané) : un paiement, même identifiant rendu ; rejeu de la clé : même paiement ; deux onglets pendant l'attente : 409 `PAYMENT_PENDING` avec le suivi ; deux onglets **simultanés** sur deux tables : `409 PAYMENT_PENDING / 200 ok ; paiements : 1` |
| G1 c | 1 | Paiement de billets en attente pour le même événement : l'achat d'une table → 409 `PAYMENT_PENDING` (même règle que les billets) |
| G2 | 2 | Table choisie sans plan montré : 400 `TABLE_CHOICE_UNAVAILABLE` ; table prise entre le devis (LIBRE) et l'achat : 409 `TABLE_TAKEN` ; limite par compte : 409 `TABLE_LIMIT` ; service fermé pendant que la fiche est ouverte : 404 ; événement suspendu : refusé, aucun paiement |
| G3 a | 4, 8 | Autre compte : « Ma table » 404, liste vide, suivi du paiement 404. Invité : billet « Invité par Awa D. », `bookingId` nul ; ni l'identifiant de la vente, ni le numéro du titulaire, ni l'identifiant du paiement dans Mes billets, dans « Reçus » (place en attente) ni dans les avis reçus (`TRANSFER_RECEIVED`, `TRANSFER_OFFERED`, 11 avis contrôlés) |
| G3 b | 4, 7 | `tickets.event_table_booking_id` illisible par `authenticated` (`has_column_privilege` faux : aucun droit de colonne depuis la règle du lot 5, donc ni REST ni temps réel) ; `event_tables`, `event_table_bookings`, `event_zones`, `event_table_plans`, `stock_reservations` : rien pour anon ni pour un client ; aucune de ces tables dans `supabase_realtime` |
| G4 | 5 | Deux demandes simultanées : `200 ok / 409 ALREADY_REFUNDED`, un seul remboursement ; montant affiché avant confirmation (157 500) = montant remboursé = total payé ; billet de l'invité annulé, ni code ni transfert, avis `TICKET_REFUNDED_HOLDER` |
| G-S 1 | 6 | Fenêtre de transfert : un seul corps envoyé, `{ recipient: value }` ; le prénom ne part jamais ; sans « Ma table », champ vide et pas de champ « Prénom » (transfert ordinaire inchangé) ; lien WhatsApp du serveur tel quel |
| G-S 2 | 9 | `Modal` : classes d'avant intactes hors `fullScreen` (défaut faux) |
| G-S 3 | 3 | Offre en cache de la fiche : `{ types, fromPrice }` seulement, lue sans compte (aucun cookie, en-tête ni session dans la fonction mise en cache) ; identifiant de la vente au seul titulaire, nom court seul pour l'invité, aucun numéro lu |
| G-S 4 | 7 | Aucune migration ; un seul abonnement temps réel dans les écrans des tables, `public_category_stock` (existante, publique, sans volume) ; aucune lecture directe de la base depuis un écran |

## Observations (pas des trous)

- **O1 — Fermeture du service par l'administration.** `PUT /api/admin/finance-settings` n'invalide pas la fiche quand
  `features.event_tables_enabled` passe à faux : la bascule « Billets | Tables » reste jusqu'à l'expiration des deux
  caches de 60 s (page et `unstable_cache`, chacun servi périmé une fois avant d'être relu). L'onglet relit l'offre
  (fermée) et l'achat est refusé (404, G2) : rien n'est vendu. Correctif simple : `invalidatePublicEvent(null, …)` après
  l'écriture de ce réglage. Une suspension d'événement, elle, invalide déjà la fiche.
- **O2 — Prix changé entre le devis et l'achat.** Le serveur demande bien le nouveau prix (G1 : devis 157 500, paiement
  210 000), mais le bouton « Payer 157 500 F CFA avec Wave » et la feuille pendant l'attente gardent l'ancien total (le
  devis n'est relu qu'au changement de type, de table ou d'opérateur). L'application de l'opérateur montre le vrai montant
  et la confirmation affiche le montant payé. Même comportement que le chemin des billets. Piste : comparer `amount` de la
  réponse d'achat au total affiché et prévenir s'il diffère.
- **O3 — Rejeu d'une clé avec un autre corps.** Comme pour les billets, une clé déjà utilisée rend le premier paiement même
  si la table demandée diffère ; sans effet ici (`PayStep` calcule une clé par corps).

## Points écartés après vérification

- **Cache de la fiche (point 3).** La clé de `unstable_cache` comprend l'identifiant de l'événement (argument) ; le résumé ne
  porte que le nombre de types et le plus petit prix ; la bascule ne reçoit que des données publiques de l'événement. La
  page préparée ne contient rien d'un visiteur. Suspension : la fiche est invalidée tout de suite
  (`lib/events/event-lifecycle.service.ts`) et la page ne lit le résumé que pour un événement PUBLIE. Fermeture du
  service : voir O1.
- **Adresse `/tickets?tab=tables#table-<vente>` d'un autre compte (point 4).** L'onglet s'ouvre, relit
  `GET /api/event-tables` du compte connecté (vide, ou ses propres tables) et dit « Cette table n'est pas dans votre
  compte » : rien de la table visée.
- **Suivi du paiement (point 4).** `tableOf` n'est lu qu'après le contrôle de propriété du paiement (404 pour un autre
  compte, G3) ; `retry_url` et `success_url` ne portent que l'événement et la vente du compte.
- **Remboursement au report (point 5).** Fermé à 24 h ou moins et si une place est entrée (tests du lot 11c-a,
  `l11c-tables` : `POSTPONEMENT_REFUND_CLOSED`, `TABLE_SEAT_USED`), fermé au nouveau début
  (`private.event_table_postponement_window` : `now() >= v_start` → fermé, `20261201000005_l11c_remboursement.sql:375-376`),
  confirmation exigée (400 sans `confirm: true`). Seul le titulaire (404 pour un autre compte).
- **Prénom d'un invité reporté sur une autre place (point 6).** Écarté : « Ma table » démonte la fenêtre de transfert à
  chaque fermeture (`{transfer && <TransferModal …/>}`), l'état repart de zéro.
- **Numéro prérempli (point 6).** Vient du carnet du téléphone (Contact Picker) et ne part qu'avec le transfert lui-même.
- **Table choisie gardée avant la connexion (point 6).** Type et table seulement (identifiants publics), 30 min, effacée à
  sa lecture et au bouton « Se déconnecter » : rien de sensible.
- **Plan partagé, mode choix d'un restaurant (point 9).** Nom lu inchangé (« …, prise ») ; le mot « Prise » est décoratif
  (`::after`, corrigé par le lot après l'axe du run 702) ; `data-table-id` expose un identifiant que l'écran a déjà dans
  ses données. Les captures e2e du lot 11b sont vertes au run complet 703 du lot (non rejoué ici).
- **Tests existants modifiés (point 10).** `notif-modeles` : seuls les liens attendus des deux types changent, toujours
  comparés à l'égalité, et `:booking` s'ajoute aux identifiants pris dans l'exemple. `design1b-billets` : deux types
  ajoutés à l'ensemble attendu, comparé à l'égalité, onglet `tables` vérifié comme les autres. Aucune assertion affaiblie.
  `cvf2b-6` : non modifiée ; esprit de la correction : voir T3.
- **SMS de la confirmation (point 8).** L'écart est justifié : 157 caractères au pire cas avec l'onglet.
- **Clé d'idempotence côté écran (point 1).** Une clé par corps (`useIdempotencyKey().keyFor`), gardée tant que l'issue est
  incertaine, remise à zéro après un refus net : conforme au chemin des billets.

## Corrections

Correctifs sur `lot11c/tables-client` (détail : `docs/lot11c-b-rapport.md`, section « Correctifs après
contre-vérification »). Les trois suites de cet audit y sont reprises **sans changer une assertion** (`009e51331c`).
Aucune migration. Run complet **714** (`a5f4db242b`, branche à jour avec `origin/main` `1c131b1830`), entièrement vert :
623/623 suites, 783 e2e, responsive 0 défaut, mesure 94 / 94 / 94. Journaux : `ci-results`, `runs/714-45830220739/`.

| Test de l'audit | Avant (run 706) | Après (run 714) | Correctif |
|---|---|---|---|
| `cv11cb-1` T1 — table tenue : message sur `public_category_stock` | rouge (0 message) | **vert** (« messages reçus … : 1 ») | heure des tranches publiques existantes réécrite par le serveur à chaque table tenue, rendue ou remboursée ; relecture de l'offre toutes les 15 s quand le plan est ouvert (`ba7e360709`) |
| `cv11cb-1` T2 — titulaire sans billet : « Ma table » atteignable | rouge | **vert** (« onglet lié aux billets seulement : false ») | onglet d'après les ventes (`GET /api/tickets`), bandeau du remboursement, avis du report vers `/tickets/<événement>` puis « Ma table » (`7366d1f4cf`, `5e057d8243`, `a5f4db242b`) |
| `cv11cb-2` G1 à G4 (7 tests) | vert | **vert** (7/7) | — (garde G1 « prix changé sans total affiché » inchangée ; le refus « prix changé » ne joue qu'avec le total affiché) |
| `cv11cb-3` T3 — prénoms effacés sans session | rouge | **vert** (« après [table-choisie…] » : prénoms effacés ; « accès générique réexporté : false ») | portée « données du compte » de la purge, écritures nommées dans `device-prefs.ts` (`6a4f90b8de`) |
| `cv11cb-3` T4 — SMS du rappel vers l'onglet | rouge | **vert** (GSM-7, 154 caractères) | `/tickets?tab=tables` (`5e057d8243`) |
| `cv11cb-3` G-S (5 tests) | vert | **vert** | aucune migration, un seul abonnement (`public_category_stock`) |
| Observation O1 (cache) | — | corrigée | `features.event_tables_enabled` invalide `fiche-publique` (`8a5561d260`) |
| Observation O2 (prix changé) | — | corrigée | total affiché comparé au prix de la base avant et après la création ; refus `TABLE_PRICE_CHANGED`, aucun paiement (`ba7e360709`, suite `l11cb-cv-correctifs`) |
| Observation O3 (rejeu d'une clé) | — | inchangée | sans effet (une clé par corps), comme les billets |

`cvf2b-6-deconnexion` : verte (15/15), non modifiée ; son classement de `device-prefs.ts` n'a pas été touché, le contrôle
des écritures des tables est dans un test nouveau (`tests/schema/l11cb-cv-correctifs.test.ts`).
