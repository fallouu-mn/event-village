# Contre-vérification du lot 11c-a — tables d'un événement : argent et sécurité

Branche auditée : `origin/lot11c/tables-argent` (tête `f9e6173528`, partie de main `71a42f01a7`). Contre-vérification
indépendante, en lecture seule : aucun correctif, aucune migration appliquée, aucun appel au projet distant, `.env.local`
non lu. Chaque affirmation du rapport du lot (`docs/lot11c-a-rapport.md`) a été revérifiée dans le code et, quand c'était
possible, par un test. Tests sur la branche `lot11c/cv-rouges` (jamais fusionnée) : `tests/audit/cv11c-*`.

- `cv11c-1-trous` : un test par trou (**rouge = trou présent**, vert = attaque bloquée) ;
- `cv11c-2-gardes` : garde-fous éprouvés (verts attendus) ;
- `cv11c-3-statique` : recopies (sans base).

Chaque suite vérifie à la fin les invariants du lot (a) à (e) et les invariants communs. Les preuves de jauge vendent
vraiment au-delà de la capacité, puis annulent l'événement (tout remboursé, ventes closes) : les invariants restent justes.

## Verdict

**L'argent tient, la jauge non.** Le lot est sûr sur le prix, la double vente, le paiement unique, le remboursement
unique, les places jamais remboursées seules, le cloisonnement, la REST, le schéma `private`, la validation et
l'interrupteur. Les recopies sont intactes. Il reste **trois trous moyens**, aucun critique ni élevé, à corriger avant la
fusion :
- T1 et T2 : la jauge en places se contourne. Un seul correctif les ferme tous les deux. T2a existe déjà sur main ;
- T3 : un invité dont la place est annulée n'est pas prévenu.

La piste d'abord jugée élevée (2e table du même type prise pour un paiement en double) s'est révélée fausse au run : son
test est vert et reste en garde-fou (G9).

| # | Trou | Gravité | Point |
|---|---|---|---|
| T1 | La capacité se baisse sous les places d'un type de table arrêté déjà vendu : billets vendus au-delà de la jauge (12 places vendues pour 6) | moyenne | 3 |
| T2a | (antérieur au lot, aussi sur main) Arrêter une catégorie de billets vendue libère ses places : survente réelle mesurée (11 billets pour 10) | moyenne | 3 |
| T2b | Même point dans le code du lot (`event_seats_refusal`) : un type de table se crée sur ces places, table vendue au-delà de la jauge (14 places pour 10) | moyenne | 3 |
| T3 | Table remboursée au report : l'invité qui avait accepté sa place la perd sans aucun avis | moyenne | 4, 9 |

Aucun trou critique ni élevé. Les sept recopies n'ont perdu aucune ligne ; les neuf tests modifiés n'ont reçu que des ajouts.

## Runs

Journaux bruts sur la branche `ci-results`, dossier `runs/<n>-<id>/` ; extraits recopiés tels quels.

| Run | Commit | Suites | Résultat |
|---|---|---|---|
| 662 | `ca649690a4` | `cv11c-1-trous`, `cv11c-2-gardes`, `cv11c-3-statique` (rapide) | trous T2, T3a, T3b, T4 de ce commit rouges pour la raison visée ; **T1 de ce commit vert** (piste fausse : test déplacé en G9) ; G1 à G7 verts ; G8 rouge par **erreur du test** (corps du devis en `type_id` au lieu de `typeId`) ; statique 7/7 ; invariants 0 violation |
| 663 | `045809b322` | `cv11c-1-trous`, `cv11c-2-gardes` (rapide) | **T1, T2a, T2b, T3 rouges** (4/4) pour la raison visée ; **G1 à G9 verts** (9/9) ; invariants 0 violation |

Sortie de l'erreur du test G8 au run 662 (corrigée au run 663) :

```
devis service fermé : HTTP 400 {"success":false,"error":"Choix de table illisible : rechargez la page et réessayez.","code":"INVALID_INPUT"}
```

Bilan du run 663 (`runs/663-45652109766/verify.log`) :

```
Suite                               Statut   Durée     Code  Journal
tests/audit/cv11c-1-trous.test.ts   FAIL     4.4s      1     .test-logs/tests__audit__cv11c-1-trous.test.ts.log
tests/audit/cv11c-2-gardes.test.ts  PASS     5.7s      0     .test-logs/tests__audit__cv11c-2-gardes.test.ts.log
──────────────────────────────────────────────────────
TOTAL : 2 suite(s) — 1 réussie(s), 1 en échec, 0 expirée(s)
[INVARIANT-LOT11C] cv11c-1-trous — (a)(b)(c)(d)(e) : 0 violation(s)
[INVARIANT-LOT11C] cv11c-2-gardes — (a)(b)(c)(d)(e) : 0 violation(s)
```

Aucun run complet : seules mes suites ont tourné, en mode rapide. Les tests du lot n'ont pas été relancés : ils sont
inchangés (run complet 656 du lot).

## Trous, par gravité

### T1 — capacité baissée sous les places d'un type de table arrêté (moyenne)

**Attaque.** Capacité 12 : billets « Entrée » 6 et un type de 1 table de 6 places. La table est vendue, puis le type est
arrêté. L'organisatrice baisse la capacité à 6 : c'est accepté. Les 6 billets se vendent encore. Résultat : 12 places
vendues pour une capacité de 6.

**Sortie brute** (`cv11c-1-trous`, T1) :

```
not ok 1 - T1 — capacité baissée sous les places d’un type de table arrêté déjà vendu : refusée (sinon billets vendus au-delà de la jauge)
error: 'event_update accepte la capacité 6 : {"ok":true,"event":{"id":"59eabf31-db78-4e17-903e-f6cf651469da","city":"Dakar","slug":null,"title":"TEST Tables 11c cv-t2 60397","status":"PUBLIE","program":null,"capacity":6,"category":"CONCERT","end — capacité 6 : 6 billet(s) + 6 place(s) de table = 12 places vendues'
```

**Cause.** La recopie d'`event_update` (`20261201000003_l11c_configuration.sql:1049-1063`) compare la nouvelle capacité à
deux sommes séparées : les places vendues ou réservées (`v_engaged`) et les quotas des catégories **actives** (`v_quota`).
Il manque la somme réelle de la jauge : les quotas actifs **plus** les places vendues des catégories arrêtées. C'est
pourtant le calcul que le lot fait lui-même dans `event_seats_refusal` (lignes 70-75) pour un type de table arrêté
(défaut D8). La capacité peut donc descendre sous ce total.

**Correctif proposé.** Dans `event_update`, calculer `v_quota` comme la jauge :
`sum(CASE WHEN c.is_active THEN c.total_quantity ELSE c.sold_quantity + c.held_quantity END * c.seats_per_unit)`. Ce
calcul corrige aussi T2. On peut aussi appeler `private.event_seats_refusal` après la mise à jour, dans un bloc annulé au
refus.

### T2 — une catégorie arrêtée libère ses places vendues (moyenne)

Le rapport du lot signale ce « point connu » pour les billets (`docs/apres-lancement.md`) et ne le corrige que pour les
types de tables (D8). Sa mesure demandée :

**T2a (antérieur au lot, aussi sur main).** Capacité 10, catégorie « Entrée » de 10 places. 4 billets sont vendus, puis
la catégorie est arrêtée. Une catégorie « Balcon » de 10 places est acceptée, et 7 billets s'y vendent. **Il y a bien
survente** : 11 billets valides pour une capacité de 10. La vente ne contrôle jamais la capacité (`ticket_sale_problems`
ne la lit pas). Seule la configuration la protège.

```
not ok 2 - T2a (antérieur au lot) — catégorie de billets vendue puis arrêtée : une nouvelle catégorie ne reprend pas ses places
error: |-
nouvelle catégorie de 10 places acceptée sur une capacité de 10 dont 4 vendues : {"ok":true,"category":{"id":"46b6a40c-ecbf-423c-b2fa-21688c26dd90","kind":"TICKET","name":"Balcon 1529","price":3000,"event_id":"7e93e72b-b612-4295-bbf6-f67df91 — capacité 10 : 11 billets VALIDE vendus
+ actual - expected

+ undefined
- 'QUOTA_ABOVE_CAPACITY'
```

**T2b (code du lot, non signalé par lui).** Même départ. Un type de table de 10 places est accepté (201), et la table
se vend : 14 places pour une capacité de 10. La fonction du lot `event_seats_refusal` (`20261201000003_l11c_configuration.sql:70-71`) compte
`ELSE 0` pour une catégorie de billets arrêtée. Le même calcul se trouve dans `ticket_category_create` (556-558) et
`ticket_category_update` (724-726).

```
not ok 3 - T2b — même point dans le code du lot (event_seats_refusal) : un type de table créé sur les places d’une catégorie de billets arrêtée est refusé
error: |-
type de 10 places sur une capacité de 10 dont 4 vendues : HTTP 201 {"success":true,"ok":true,"type":{"id":"b027a170-819e-4a3f-9872-90bf389c45a8","kind":"TABLE","name":"Table VIP 9bb644","price":150000,"event_id":"a19cceb5-e739-497d-b9c2-f66a2a92cc5e","sale_e — capacité 10 : 4 billet(s) + 10 place(s) de table = 14 places vendues
+ actual - expected

[
+   201,
+   undefined
-   409,
-   'QUOTA_ABOVE_CAPACITY'
]

0: 409
1: 'QUOTA_ABOVE_CAPACITY'
0: 201
```

**Correctif proposé (T1 et T2 ensemble).** Une seule règle de jauge, dans les quatre endroits (`event_seats_refusal`,
`ticket_category_create`, `ticket_category_update`, `event_update`) : `sum(CASE WHEN is_active THEN total_quantity ELSE
sold_quantity + held_quantity END * seats_per_unit)`, quel que soit le genre. Le mieux est une seule aide, appelée par les
quatre. Il faut aussi relire, sur event-village-dev, les événements où une catégorie arrêtée a des ventes. Après le
correctif, toute nouvelle hausse y sera refusée tant que la capacité n'est pas relevée. C'est voulu, mais
l'organisatrice verra un refus. Selon `docs/apres-lancement.md`, étendre la règle aux billets « change des suites
existantes » : il faudra les nommer au correctif, et signaler chaque assertion changée. Ici, aucune suite du lot n'a
été relancée.

### T3 — invité non prévenu au remboursement de la table (moyenne)

**Attaque (cas normal).** Le titulaire envoie une place à Fatou, qui l'accepte : le billet est maintenant le sien.
L'événement est reporté de 48 h, et le titulaire fait rembourser la table entière. La place de Fatou est bien annulée
(`REMBOURSE` au run : le versement simulé est déjà fait ; garde-fou vert), mais **aucun avis** ne lui part : elle viendra à la porte avec un billet annulé.

**Sortie brute** (`cv11c-1-trous`, T3) :

```
not ok 4 - T3 — table remboursée au report : l’invité qui avait accepté sa place est prévenu que sa place est annulée
error: 'aucun avis à l’invité (148dad70-4078-445c-bb74-a31be5959e1f) après le remboursement de la table : place REMBOURSE, boîte d’envoi de l’invité avant : 10 ligne(s), après : 10'
```

**Cause.** `event_table_postponement_refund` (`20261201000005_l11c_remboursement.sql:440-446`) annule les transferts en
attente et appelle `refund_request(paiement)`. Cette fonction passe les billets en remboursement sans prévenir personne.
Pour un billet seul, `ticket_refund_request` (même fichier, 174-177 et 248-255) prévient le porteur actuel d'un billet
transféré (`TICKET_REFUNDED_HOLDER`). Le remboursement de la table ne le fait pas. L'annulation de l'événement n'est pas
touchée : `EVENT_CANCELLED` part à tous les porteurs.

**Déjà connu du lot ?** En partie. `docs/apres-lancement.md` (ajout du lot) le reporte avec ce motif : « aucun type
d'avis prévu par la consigne ». Mais le rapport du lot ne le cite pas, et le motif ne tient pas : le type existant
`TICKET_REFUNDED_HOLDER` (cloche, SMS, push, email) dit déjà au porteur d'un billet transféré que sa place est
remboursée à l'acheteur. Aucun type nouveau n'est nécessaire.

**Correctif proposé.** Dans `event_table_postponement_refund`, avant `refund_request`, mettre en file
`TICKET_REFUNDED_HOLDER` (clé `TICKET_REFUNDED_HOLDER:<billet>`, données `ticket_id` et `category`) pour chaque place
`VALIDE` dont le porteur n'est pas le titulaire. C'est le même bloc que `ticket_refund_request`, lignes 248-255.

## Garde-fous éprouvés (verts)

Suite `cv11c-2-gardes`, **9/9 verts au run 663**. Attaques par les routes (jeton de l'attaquant) ou par la REST (clé anon et jeton) ;
la clé de service ne sert qu'à la mise en place, aux lectures et à l'essai des gardes « même par la clé de service ».

| # | Attaque | Résultat |
|---|---|---|
| G1 | Corps de l'achat avec `price`, `amount`, `seats`, `unit_price`, `hold_minutes`, `partner_id`, `total`, `quantity` ; type ou table d'un autre événement ; devis avec un prix ou un type d'ailleurs | 400 `INVALID_INPUT` pour chaque champ, aucun paiement ; 404 `TABLE_TYPE_NOT_FOUND` et `TABLE_NOT_FOUND` ; montant = prix de la table + frais du réglage ; garde = `finance.payment_hold_minutes` |
| G2 | Deux webhooks et une relève en même temps sur le même paiement | une vente, 6 billets, type +1, un seul `EVENT_TABLE_CONFIRMED` par canal |
| G3 | 3 achats simultanés du même compte ; puis 2 tables (deux types) et une 3e avec un autre numéro payeur | un seul paiement en attente (les autres 409 `PAYMENT_PENDING`) ; 3e table 409 `TABLE_LIMIT`, sans paiement ; 2 ventes actives |
| G4 | Paiement en attente, événement annulé, succès SamirPay, webhook rejoué, relève | remboursé en entier une seule fois, aucune vente ni billet |
| G5 | Autre organisatrice : lecture de la configuration, plan, création, modification et retrait d'un type, porte ; types, tables et zones d'un autre événement glissés dans son plan ; « Ma table » par l'invité ; REST (anon, titulaire, invité, autre organisatrice) sur `event_tables`, `event_table_plans`, `event_table_bookings`, `tickets` ; schéma `private` (jeton et clé de service) | 404 ou 403 partout, rien d'écrit ; `TABLE_TYPE_NOT_FOUND`, `TABLE_NOT_FOUND`, `ZONE_NOT_FOUND` ; invité 404 et aucune table ; « Ma table » : « Fatou N. », numéro en attente réduit à « •• » et ses 2 derniers chiffres, ni nom de famille ni numéro ; lien WhatsApp sans jeton ; porte : prénom et initiale ; aucune lecture ni écriture REST ; `private` refusé à tous |
| G6 | Prix ou places d'un type pendant une simple attente (route, clé de service) ; retrait de la table attendue | 409 `PRICE_LOCKED_AFTER_SALES` ; clé de service refusée (EVT11/EVT12) ; 409 `TABLE_SOLD` ; type inchangé |
| G7 | Création d'un type et de 3 tables, 2e type, plan (1 renumérotation, 2 ajouts), retrait d'un type, sur un événement publié | une alerte `ADMIN_EVENT_TABLES_CHANGED` par enregistrement, par administrateur et par canal (1, 2, 3, 4) ; aucune `ADMIN_EVENT_CHANGED` |
| G8 | Interrupteur fermé : devis, achat, création, modification, plan | 404 `SERVICE_UNAVAILABLE` partout, aucun paiement, offre fermée et vide |
| G9 | Deux tables du même type achetées l'une après l'autre par le même compte (limite 2) | les deux vendues, ni `duplicate_of` ni alerte « paiement en double » |

Invariants à la fin de chaque suite : lot 11c-a (a) à (e), paiements, finances, contrôle d'accès, cycle, avis : **0 violation** dans les deux suites (runs 662 et 663).

## Point 9 — avis

| Type | Canaux | Nuit (`night_policy`) | Lien | Vérifié |
|---|---|---|---|---|
| `EVENT_TABLE_CONFIRMED` (titulaire) | cloche, push, email, SMS | `SEND` (tout de suite) | `/tickets/<événement>` | migration 06, catalogue |
| `EVENT_TABLE_SOLD` (organisatrice, groupé par 30 min) | idem | `DEFER`, sauf événement à moins de 12 h (`notif_event_soon`, appliqué au retrait de la file) | `/partner/events/<id>?tab=ventes` | idem |
| `EVENT_TABLE_SEATS_REMINDER` (titulaire, facultatif « Rappels ») | idem | `DEFER` | `/tickets/<événement>` | idem |
| `ADMIN_EVENT_TABLES_CHANGED` (administrateurs `events.read`) | idem | `DEFER` | `/admin/events/<id>` | idem ; une alerte par enregistrement (G7) |

Le registre, les liens et les textes SMS exacts sont vérifiés par `notif-modeles` (suite modifiée par le lot, ajouts
seulement). Elle calcule elle-même le GSM-7 (table 03.38) et un segment au pire cas pour chaque type du registre ; elle
était verte au run complet 656 du lot. Aucun mot technique dans les textes du catalogue. Aucun avis ne montre le
numéro ni le nom de famille d'un invité : ce sont les données des écrans, et G5 le vérifie. Seul T3 manque (avis à
l'invité). Pour le rappel créé la nuit, voir la remarque plus bas.

## Point 10 — recopies et tests modifiés

**Recopies.** Chaque recopie a été comparée, ligne par ligne, à la dernière définition de main (blancs repliés) : par un
script, puis par la suite `cv11c-3-statique`.

| Fonction | Dernière définition sur main | Lignes retirées ou changées | Ajouts |
|---|---|---|---|
| `ticket_category_create` | `20261119000002_f2b_couleur_consigne.sql` | 2 (somme des quotas → somme de places) | 4 |
| `ticket_category_update` | `20261121000008_cvf2b_consigne_controle.sql` | 2 (idem) | 8 (refus `TABLE_TYPE`, jauge) |
| `event_update` | `20261121000005_cvf2b_avis_en_cours_envoi.sql` | 2 (vendus et quotas en places) | 7 (`CAPACITY_REQUIRED`) |
| `checkout_create_payment` | `20261111000005_lot9quater_argent.sql` | 0 | 4 (renvoi vers `event_table_checkout`) |
| `payment_confirm` | `20261125000003_f4_ventes.sql` | 0 | 31 (tables) |
| `ticket_refund_request` | `20261116000001_f2a_fiche_suspendue.sql` | 0 | 5 (`TABLE_SEAT_NOT_ALONE`) |
| `ticket_postponement_refund_open` | `20261109000006_lot9bis_argent.sql` | 0 | 4 |

Aucune ligne perdue. Les 6 lignes changées sont celles de la jauge, et elles sont justement en cause dans T1 et T2. Les
déclencheurs d'alerte recréés (`trg_ticket_categories_admin_alert`, `_update_alert`) gardent leurs colonnes et leur
condition de main, avec `kind = 'TICKET'` en plus. Les droits des fonctions recopiées restent ceux de main
(`CREATE OR REPLACE`).

**Tests modifiés (9).** Chaque assertion a été comparée avant et après (`git diff 71a42f01a7..f9e6173528`). Aucune n'a
été retirée ni affaiblie :
- `payment-invariants` (a) : billets attendus = Σ quantité × places par unité. L'égalité reste stricte, et vaut 1 par
  unité pour un billet ;
- `recette-invariants` (t1) : seules les places **reliées à leur vente** sortent de la règle. Une place de table sans
  vente y reste rouge, et (e) la vérifie aussi ;
- `f3b-reglages` : les seules clés `event_tables.*` sont validées par `event_tables_setting_valid`, mêmes bornes ;
- `edition-services`, `notif-modeles`, `notif-outbox`, `notif-migration`, `r3-fonctions-rpc`, `zones-schema` : ajouts
  seulement (0 ligne retirée).

## Points écartés après vérification

| Piste | Vérification | Conclusion |
|---|---|---|
| Montant, places ou durée de garde venus du navigateur | Le schéma de la route est strict (`CheckoutSchema.strict()`). La garde vient de `readHoldMinutes` (réglage), le partenaire est lu sur l'événement, le prix sous verrou dans `event_table_checkout` | Fermé (G1) |
| 2e table du même type par le même compte prise pour un « paiement en double » (`payment_duplicate_of` compare `type:1`) | La fonction n'attrape que deux paiements **ouverts en même temps** (`x.created_at < y.paid_at`), ce que la règle d'un paiement en attente par compte et par événement empêche pour les tables. Test écrit comme trou, vert au run 662, gardé en G9 | Fermé (G9). Le lot n'avait testé que la limite 1 : G9 couvre la limite 2 |
| Double vente concurrente ou séquentielle | Type puis tables verrouillés (`FOR UPDATE`), balayage des attentes échues sous le même verrou, index uniques (une attente et une vente actives par table), relecture sous verrou dans `payment_confirm` | Fermé (test du lot C, G2) |
| Paiement tardif dont l'attente a échu sans être encore balayée (`status = 'ACTIVE'`, `expires_at` passé) | `payment_confirm` ne rembourse qu'une attente close (`status <> 'ACTIVE'`). Personne n'a pu prendre la table entre-temps : toute nouvelle attente balaie d'abord les attentes échues, sous le verrou du type. La vente est donc honorée | Écart avec la règle écrite (« remboursé même si la table est encore libre »), **sans risque** : aucune double vente, client servi. À trancher : garder (favorable au client) ou ajouter `OR v_res.expires_at <= now()` |
| Accaparement par plusieurs comptes ou numéros payeurs | Numéro vérifié exigé ; un paiement en attente par compte et par événement ; 3 par numéro payeur et par heure ; 2 tables par compte (G3). Chaque compte peut tenir une table le temps de la garde, comme pour les billets | Risque résiduel, le même que pour les billets |
| Fiche de l'organisatrice suspendue | La suspension réelle (`partner_status_set`, `20261117000001_f3a_securite.sql`) suspend ses événements publiés. La vente est alors refusée (`EVENT_SUSPENDED`, test du lot D). La configuration est refusée par `ticket_category_guard`. Une fiche passée à SUSPENDU directement en base laisserait vendre, comme pour les billets | Fermé par le chemin réel |
| Versement avant la fin de l'événement | Cible `TICKET` inchangée : crédit `VENTE` disponible à `fin_payout_available_at`, gelé si l'organisatrice est suspendue | Inchangé, hors du lot |
| Commission sur une table | `finance_compute('TICKET')` ne calcule aucune commission : la part de l'organisatrice est le prix facial | Conforme |
| Remboursement d'un paiement entier sans fermer la vente | `CashoutService.requestRefund` (seul appel direct de `refund_request` côté serveur) n'a aucun appelant. Annulation et report ferment la vente | Fermé |
| Place annulée encore acceptée au scanner | Le scan et le QR hors ligne traitent une place comme un billet ordinaire (statut `VALIDE` exigé, rotation et règle des 48 h inchangées) | Aucune règle propre, aucun écart |
| Annulation de l'événement avec une place encore `VALIDE` | La boucle de `event_cancel` qui reprend les billets encore valides reçoit `TABLE_SEAT_NOT_ALONE` sans erreur. La dernière mise à jour passe ensuite la place en `ANNULE` | Fermé |
| Lien de la porte ou de « Ma table » | Porte : `scan_scanner_authorized` (propriétaire à fiche VALIDE, contrôleurs affectés, administration habilitée). « Ma table » : titulaire seul (invité, autre compte : 404) | Fermé (G5) |
| `ticket_id` des places d'invités rendus au titulaire | Aucune route n'agit sur le billet d'un autre compte avec ce seul identifiant | Sans effet |
| Schéma `private` | Fermé à `anon`, `authenticated` et `service_role` (même règle que les lots 9 quinquies et 12a). PostgREST ne l'expose pas (G5) | Fermé |
| Rappel des places la veille, créé la nuit | Un rappel créé entre le début de la nuit et minuit la veille voit son SMS reporté au matin du jour J. Son texte dit alors « demain » | Remarque faible (cas limite : la tâche passe dès 10 h la veille), même schéma que les rappels existants ; pas de test |
| Changement de zone ou de position d'une table après validation | L'alerte part sur l'ajout, le retrait, le numéro et le type (`UPDATE OF number, category_id`), pas sur la zone | Remarque : la zone ne sert qu'au libellé du badge, pas au contrôle d'accès |
| Geste commercial sur une table (organisatrice ou administration) | Seuls l'annulation et le report remboursent une table ; une place seule est toujours refusée | Conforme à la décision du client ; à noter pour le support |
