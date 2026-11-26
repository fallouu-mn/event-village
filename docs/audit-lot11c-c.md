# Contre-vérification du lot 11c-c — tables : écrans de l'organisatrice, porte, scanner, administration

- **Branche auditée** : `origin/lot11c/tables-organisatrice` (`05b0145303`, rapport `docs/lot11c-c-rapport.md`), lue sans
  modification. Le rapport du lot n'a servi qu'à repérer ses affirmations ; chacune a été revérifiée dans le code et par
  un test.
- **Branche des tests** : `lot11c/cv-rouges-c`, jamais fusionnée. Aucun correctif appliqué, aucune migration appliquée,
  aucun appel au projet distant, `.env.local` non lu, aucune construction locale.
- **Suites** (`tests/audit/`) :
  - `cv11cc-1-trous` : un test par trou, **rouge sur le lot** ;
  - `cv11cc-2-gardes` : attaques bloquées, **vertes** ;
  - `cv11cc-3-statique` : contrôles sans base, **verte** ;
  - `cv11cc-helpers` : aides, dont l'**entrelacement forcé** de deux requêtes. Le client Supabase relit `fetch` à chaque
    appel ; une action est donc glissée juste avant un appel précis du serveur. On obtient l'effet de deux requêtes
    simultanées sans dépendre du hasard.
- **Runs rapides** : 707, 709 et 710 (détail au § 6).

## 1. Verdict

**Aucun trou critique ni élevé.** Les points 1, 2, 6, 8, 9 et 10 de la consigne tiennent : la migration, l'identité de
l'appelant, le formulaire, le scanner, les tests modifiés et le poids du scanner.

Cinq trous sont prouvés par un test rouge :

| | Gravité | Trou | Origine |
|---|---|---|---|
| **T1** | moyen | Liste de la porte lisible par un contrôleur affecté **hors de la plage du contrôle** : titulaires et invités. | Fonction du lot 11c-a, exposée par les pages et le lien du lot 11c-c |
| **T2** | faible | Copie refusée en cours après la validation : avis `ADMIN_EVENT_TABLES_CHANGED` envoyés pour un changement qui n'a pas eu lieu. | Lot 11c-c |
| **T3** | faible | Deux copies simultanées depuis deux événements : les deux répondent 200 et un type reste sans table. | Lot 11c-c |
| **T4** | faible (texte seul) | Texte du refus lu par l'écran différent de celui de l'écriture : `EVENT_LOCKED`, `ADMIN_CANNOT_EDIT`. | Lot 11c-c |
| **T5** | faible | « Supprimer » proposé sur un type après un paiement échoué ; la suppression est refusée. | Lot 11c-c |

Une affirmation du rapport du lot est inexacte : « au moindre refus, les types créés par la copie sont retirés ». Les
types sont bien retirés, mais les avis aux administrateurs restent (T2). Avec une copie concurrente, une copie peut
aussi effacer les tables de l'autre (T3).

## 2. Trous, par gravité

### T1 — moyen : liste de la porte lisible hors de la plage du contrôle

**Constat.** Un contrôleur affecté lit, à tout moment, la liste des tables vendues : numéros, types, titulaires et
invités en prénom et initiale. Cela vaut dix jours avant l'ouverture du contrôle comme sur un événement suspendu.

C'est contraire à la règle du projet depuis la finition 1 (complément 10, `cvf1c-t4`). Hors de la plage du contrôle,
`scan_event_problem` coupe :

- le scan ;
- la vérification manuelle ;
- la liste des invités (`ticket_guest_list_search` : `CONTROL_CLOSED`, aucune donnée).

Le lot 11c-c expose cette liste au contrôleur par deux chemins :

- la page `/controller/porte/[id]` ;
- le lien « Liste des tables » du scanner, affiché dès qu'une table est vendue, que le contrôle soit ouvert ou non.

**Sortie brute** (run 709, `tests__audit__cv11cc-1-trous.test.ts.log`) :

```
error: 'hors de la plage, la porte livre les titulaires et invités (HTTP 200) : HTTP 200 {"success":true,"ok":true,"items":[{"zone":null,"seats":6,"guests":["Mariama S."],"holder":"Awa D.","entered":0,"type_name":"Carre t1-avant","table_number":1}],"read_at":"2026-11-26T12:49:12.156679+00:00","event_id":"2354869b-9331-41ea-8788-6047c5bac07b"}'
error: 'événement suspendu, la porte livre les titulaires et invités (HTTP 200) : HTTP 200 {"success":true,"ok":true,"items":[{"zone":null,"seats":6,"guests":["Mariama S."],"holder":"Awa D.","entered":0,"type_name":"Carre t1-suspendu","table_number":1}],"read_at":"2026-11-26T12:49:12.552688+00:00","event_id":"5a56fa46-220c-473f-aeee-b38c7a02b8e2"}'
```

Dans les deux cas, le test vérifie d'abord que `scan_event_problem` rend `event_not_open`, puis `event_suspended`.

**Lignes en cause.**

- `supabase/migrations/20261201000004_l11c_vente.sql:1030` : `event_table_door_list` ne vérifie que
  `scan_scanner_authorized` ;
- `app/controller/scanner/page.tsx:1135` : le lien ne dépend que de `tables_sold > 0` ;
- `app/controller/porte/[id]/page.tsx` : la page du contrôleur.

**Correctif proposé.**

1. Dans `event_table_door_list` (recopie dans une migration nouvelle), pour un lecteur qui n'est **ni la propriétaire,
   ni un administrateur** : si `scan_event_problem(v_event)` n'est pas NULL, rendre
   `{ ok: false, http: 409, code: 'CONTROL_CLOSED', problem, opens_at }`. Aucune donnée ne sort, comme pour
   `ticket_guest_list_search`.
2. La propriétaire et l'administration gardent la liste : ils lisent déjà les mêmes titulaires par le pilotage, et
   l'impression à l'avance reste possible.
3. La route rend 409.
4. `DoorList` affiche « Le contrôle ouvre à … » ou « Contrôle fermé ».
5. Le lien du scanner n'apparaît que si `scan.open` est vrai.

### T2 — faible : copie refusée en cours, avis aux administrateurs quand même

**Constat.** Le scénario :

- l'événement cible est publié ;
- la source a deux types ;
- le 2ᵉ type dépasse la jauge.

La copie répond 409. Le type déjà créé est retiré et aucune table ne reste : c'est le garde-fou G6.

Mais la copie enchaîne des appels séparés depuis Node, chacun dans sa propre transaction. La création du 1ᵉʳ type,
puis son retrait, déclenchent chacun `ADMIN_EVENT_TABLES_CHANGED` (`notif_event_tables_admin_alert`). Résultat :

- **8 avis** en file, un par administrateur et par transaction ;
- **2 lignes** « changement » sur la fiche de l'administration, pour un plan qui n'a pas bougé.

**Sortie brute** (run 709) :

```
copie refusée sans aucun effet, mais 8 avis ADMIN_EVENT_TABLES_CHANGED en file et 2 changement(s) dans l’historique de la fiche : [{"at":"2026-11-26T12:49:12.763599+00:00"},{"at":"2026-11-26T12:49:12.74038+00:00"}]
```

**Lignes en cause.** `lib/event-tables/report.server.ts:50-127` (`copyTablesFrom`) : la boucle de
`event_table_type_save` (l. 87), le retrait par `event_table_type_delete` (l. 76) et l'enregistrement par
`event_tables_save` (l. 124) se font en transactions séparées.

**Correctif proposé.** Une seule fonction en base, `public.event_table_copy(p)`, réservée au rôle de service :

1. elle appelle `private.event_table_refusal`, qui verrouille l'événement et ses catégories ;
2. elle vérifie, **sous ce verrou**, que la cible n'a aucun type de table ;
3. elle vérifie que la source appartient à la même organisatrice ;
4. elle crée types et tables avec numéros et positions ;
5. elle appelle `private.event_seats_refusal`.

Le tout se fait **en une transaction** : au moindre refus, rien n'est écrit et aucun avis ne part, car les avis du
déclencheur sont annulés avec la transaction. La route ne fait plus que relayer. Ce correctif règle aussi T3, ainsi que
la course décrite au § 5.

### T3 — faible : deux copies simultanées depuis deux événements différents

**Constat.** Le test force l'entrelacement suivant : la copie A a lu une cible vide ; juste avant son 1ᵉʳ
enregistrement, la copie B s'exécute en entier sur la même cible et répond 200. La copie A continue :

- elle crée son type ;
- elle enregistre la **liste complète de SES tables** par `event_tables_save`, qui supprime toute table absente de la
  liste ;
- elle répond 200.

Résultat : **deux réponses 200**, et le type « Carre T3 B » reste en base **sans aucune table**
(`total_quantity` = 0). L'organisatrice croit avoir deux plans copiés ; un seul existe, avec un type fantôme.

Une même source copiée deux fois ne crée jamais de doublon : le nom du type est unique sous verrou (G7, vert). La règle
« jamais de tables en double » tient donc. C'est la règle « copie sur un événement sans table » qui ne tient pas sous
concurrence.

**Sortie brute** (run 709) :

```
copie A 200, copie B 200 ; type(s) laissé(s) sans table : [["Carre T3 B",0,0],["Carre T3 A",2,2]]
```

**Lignes en cause.**

- `lib/event-tables/report.server.ts:61` : la cible vide est vérifiée hors de tout verrou, avant les écritures ;
- `lib/event-tables/report.server.ts:124` : l'enregistrement de la liste complète efface les tables créées entre-temps.

**Correctif proposé.** Le même que pour T2 : vérifier que la cible est vide sous le verrou de l'événement, dans la
fonction unique `event_table_copy`.

### T4 — faible (texte seul) : texte du refus lu différent de celui de l'écriture

**Constat.** Les **codes** sont identiques dans les 8 états éprouvés (G9, vert) :

- modifiable, brouillon ;
- validation, suspendu, terminé, annulé ;
- service fermé, fiche suspendue ;
- s'y ajoute l'administration.

L'**ordre** des refus est identique aussi (S2, statique). Mais les **textes** diffèrent pour `EVENT_LOCKED` et
`ADMIN_CANNOT_EDIT`. Le rapport du lot affirme que seul le texte de l'attente de validation est propre à l'écran.

L'effet reste limité : l'éditeur passe en lecture seule dès qu'un refus est lu, si bien que l'organisatrice ne voit que
le texte de l'écran.

**Sortie brute** (run 709) :

```
TERMINE : écran « Un événement terminé ou annulé ne se modifie plus : ses tables restent en lecture. » ≠ écriture « La billetterie d'un événement terminé ou annulé ne peut plus être modifiée. »
ANNULE : écran « Un événement terminé ou annulé ne se modifie plus : ses tables restent en lecture. » ≠ écriture « La billetterie d'un événement terminé ou annulé ne peut plus être modifiée. »
ADMIN_CANNOT_EDIT : écran « Seul l’organisateur modifie les tables de son événement. » ≠ écriture « Seul l'organisateur modifie la billetterie de son événement. »
```

**Lignes en cause.** `supabase/migrations/20261215000001_l11cc_lectures_tables.sql:50`, `:58` et `:187`.

**Correctif proposé.** Deux voies, au choix :

- reprendre dans `event_table_edit_refusal` les textes exacts de `ticket_category_guard` ;
- ou garder les textes propres aux tables et le dire dans le rapport du lot, pour trois codes et non un seul.

Si les textes sont gardés, le test T4 est à retirer, pas à « corriger ».

### T5 — faible : « Supprimer » proposé, suppression refusée

**Constat.** Le scénario :

- une cliente commence le paiement d'une table ;
- le paiement échoue (`payment_release` FAILED) ;
- il ne reste rien en paiement et rien de vendu.

La lecture rend alors `ever_sold = false` et `locked = false`, et l'éditeur affiche « Supprimer »
(`TablesEditor.tsx:261`). La suppression répond pourtant **409 `CATEGORY_HAS_SALES`**, avec le texte « Des tables de ce
type ont déjà été vendues ou mises en paiement… ».

Le refus de l'écriture est légitime : `stock_reservations.category_id` est en `ON DELETE RESTRICT`
(`20261031000013_lot2_reservations.sql:46`). C'est donc l'écran qui cache une raison du refus, contrairement au point 7
de la consigne.

**Sortie brute** (run 709) :

```
écran : « Supprimer » proposé (ever_sold false, locked false) ; écriture : HTTP 409 {"success":false,"error":"Des tables de ce type ont déjà été vendues ou mises en paiement : ce type ne se supprime plus, arrêtez plutôt sa vente.","code":"CATEGORY_HAS_SALES"}
```

**Lignes en cause.**

- `supabase/migrations/20261201000003_l11c_configuration.sql:318-321` : `event_table_type_delete` refuse dès qu'une
  réservation existe, quel que soit son statut ;
- `supabase/migrations/20261215000001_l11cc_lectures_tables.sql:141-142` : la lecture ne rend que `locked` et
  `ever_sold` ;
- `components/event-tables/TablesEditor.tsx:261` : la condition du bouton.

**Correctif proposé.**

1. Ajouter à chaque type, dans `event_table_report`, un champ `deletable` calculé avec **exactement** la condition de
   `event_table_type_delete` : rien de vendu, rien en paiement, aucune vente, aucune réservation quel que soit son
   statut.
2. Afficher « Supprimer » sur `deletable`, et sinon « Arrêter la vente » avec la raison.

Le test T5 compare « proposé » et « accepté » : il passe au vert avec ce correctif comme avec tout autre correctif qui
rend l'écran et l'écriture cohérents.

## 3. Garde-fous verts (run 710, `cv11cc-2-gardes` 15/15 ; run 707, `cv11cc-3-statique` 7/7)

| | Attaque essayée | Résultat |
|---|---|---|
| **G0** | Migration sur la base migrée | `03-verification.sql` : tous les points OK (liste blanche inchangée). Migration rejouée deux fois de plus dans une transaction annulée. Droits réels : `event_table_report` exécutable par `service_role` seul. `private.event_table_edit_refusal` exécutable par aucun rôle, `PUBLIC` et clé de service compris (appel PostgREST refusé). `SECURITY DEFINER`, `search_path=public` pour les deux. |
| **S1** | Contenu de la migration | Deux fonctions **nouvelles**, absentes de toute migration antérieure. Hors des corps : seulement `CREATE OR REPLACE FUNCTION`, `REVOKE`, `GRANT` et `COMMENT`. Ni `BEGIN` ni `COMMIT`. Aucune écriture ni aucun verrou dans les corps. |
| **S2** | Ordre des refus | `event_table_edit_refusal` rend les 8 mêmes codes, dans le même ordre, que la dernière définition de `event_table_refusal` + `ticket_category_guard`. |
| **G1** | Identité | Rien ne change ce que voit l'appelant : `actor_id` ou `event_id` en paramètres d'adresse, en-têtes `x-user-id` et `x-actor-id`, `p` en paramètre. Pour une autre organisatrice, une cliente ou un contrôleur : 404. Copie : `actor_id`, `user_id`, `event_id` ou `to_event_id` ajoutés au corps sont ignorés. Une source d'autrui donne 404 et rien n'est écrit ; la cible reste celle de l'adresse. |
| **G2** | Accès | Lecture : 404 pour le contrôleur **affecté à l'événement**, la titulaire, l'invitée et un contrôleur d'ailleurs. Route admin : 403 pour la propriétaire, un contrôleur ou une cliente, 401 sans session. Porte : 403 pour une affectation retirée, la titulaire, l'invitée, un administrateur sans permission ou avec `events.read` seul, une autre organisatrice ou un contrôleur d'ailleurs ; 401 sans session. Aperçu et copie : 401 sans session, 403 pour une cliente. Affectations : 403 pour une cliente ; une affectation retirée ou celle d'un autre contrôleur ne montre rien de l'événement. |
| **G3** | Données personnelles | Lecture, fiche de l'administration et porte : ni téléphone (deux formats), ni courriel, ni nom de famille, ni identifiant de compte ou de paiement. Porte : ni identifiant de vente ou de billet, et clés limitées à `entered, guests, holder, seats, table_number, type_name, zone`. |
| **G4** | Copie sur une cible non modifiable | 409 et rien d'écrit pour une cible en validation, suspendue, terminée ou annulée, et pour le service fermé. Fiche suspendue : 403 `PARTNER_SUSPENDED`, rien d'écrit. |
| **G5** | Copie après validation | `ADMIN_EVENT_TABLES_CHANGED` en file et historique de la fiche alimenté. |
| **G6** | Copie refusée au 2ᵉ type (brouillon) | Aucun type, aucune table, aucun plan. |
| **G7** | Même source copiée deux fois, entrelacée | Une réponse 200, une 409 ; un seul type ; numéros 10, 11, 12 une fois chacun. |
| **G8** | Formulaire et requêtes fabriquées | Le type de table reste identique en base après : PATCH du prix, du quota, de la mise en vente ou du nom par la route des catégories (refusé) ; DELETE (409 `TABLE_TYPE`) ; `ticket_category_update` direct (`TABLE_TYPE`) ; POST d'une catégorie avec `kind: 'TABLE'` (aucun type de table créé ; au plus une catégorie de billets ordinaire à 1 place) ; PUT de l'événement avec `ticket_categories` (refusé) ; capacité 30, sous les places en vente (refusée). |
| **S4** | Formulaire, côté code | Chaque lecture de `event.ticket_categories` dans `EventForm` passe par `isTicketCategory`. |
| **G9** | Refus lu = refus écrit (codes) | Modifiable et brouillon : écran modifiable, écriture acceptée. Pour validation, suspendu, terminé, annulé, service fermé, fiche suspendue et administration : même code à l'écran et à l'écriture. |
| **G10, S3** | Scanner | Aucun badge pour un billet ordinaire ni pour un billet inconnu ; badge d'une place de table : « Table N · Carre garde », 0/6. Le badge ne vient que de `tableOf(body.table)`, et la route ne l'ajoute qu'à la réponse de la base. Aucun chemin d'import, statique ou dynamique, depuis `app/controller/scanner/page.tsx` et `app/controller/layout.tsx` n'atteint `components/event-tables`. |

Invariants des deux suites : **0 violation** (lot 11c, réservations, finance, accès, cycle, notifications).

## 4. Tests existants modifiés par le lot (point 9)

| Fichier | Avant → après | Verdict |
|---|---|---|
| `tests/security/r3-fonctions-rpc.test.ts` | Une ligne ajoutée : `['event_table_report', { p: {} }]`. | Ajout seul : une fonction de plus doit refuser `anon` et `authenticated` (42501). Renforcé. |
| `tests/parcours/evenements-verrous-ecran.test.ts` | 3 textes attendus remplacés sur 4, même boucle `form.includes(t)`, même nombre d'assertions ; le refus de « peut seulement augmenter » est gardé. | Non affaibli. Le nouveau texte (« places mises en vente, billets et tables compris ») est exact : le plancher servi, `event_edit_locks.active_quota`, vaut `private.event_seats_gauge` depuis la recopie de la CV 11c-a (`20261201000007:866-886`). |
| `e2e/support/screens.ts` (`admin-cloture-motif`) | Une réponse imposée ajoutée pour `GET /api/admin/events/<uuid>/tables` : `{ success, ok, types: [], bookings: [] }`. | Ne masque pas d'erreur réelle. La fiche de cette capture est elle-même imposée : événement fictif `…0931`, inconnu de la base. Sans la réponse imposée, la lecture des tables rend 404, une erreur de console due au faux événement et non au code. Le bouchon ne vaut que pour cette capture. Les vraies lectures sont couvertes par `l11cc-ecrans` (A, G) et `lot11cc.responsive.spec.ts`. |
| `tests/helpers/design-files.ts`, `e2e/support/responsive-pages.ts` | Ajouts seulement : 10 fichiers soumis au contrôle du design, 2 pages au contrôle responsive. | Renforcés. |

## 5. Points écartés ou notés après vérification

- **Doublons de tables entre deux copies de la même source** : impossibles. `event_table_type_save` prend le verrou de
  l'événement (`ticket_category_guard`, `FOR NO KEY UPDATE`) puis vérifie l'unicité du nom ; la 2ᵉ copie reçoit
  `CATEGORY_NAME_TAKEN` (G7).
- **Formulaire de l'événement** : la protection ne dépend pas de l'écran. Le déclencheur `trg_0_ticket_categories_table_guard`
  refuse toute écriture d'un type de table hors des fonctions des tables, et `ticket_category_update` rend `TABLE_TYPE`
  (G8).
- **Copie après validation** : `ADMIN_EVENT_TABLES_CHANGED` part bien (G5).
- **Course pendant une copie sur un événement publié** (notée, non prouvée par un test : fenêtre de quelques
  millisecondes). Le type copié est en vente dès sa création, avant l'enregistrement des positions. Une table achetée dans
  cet intervalle fait refuser `event_tables_save` (`TABLE_SOLD`) ; le retrait du type est alors refusé
  (`CATEGORY_HAS_SALES`) et le type reste, alors que la copie a répondu 409. Le correctif de T2 et T3 (une transaction)
  la supprime.
- **La copie remet en vente un type arrêté à la source.** La copie n'envoie pas `is_active` et la création vaut « en
  vente ». À décider : c'est un choix de produit, pas un trou.
- **Badge sur un refus** : `event_table_badge` ne regarde pas l'état de la vente. Une place remboursée ou annulée scannée
  montre le verdict du serveur (refus) **avec** le badge « Table N · type » et les entrées. Rien de faux : le badge dit à
  quelle table la place appartenait. Ce point n'a pas été éprouvé par un scan réel, qui exige un événement dans la plage
  du contrôle. Hors ligne, le scanner ne rend aucun verdict : c'est un incident technique, sans badge. Une reprise est
  jugée par le serveur au moment du renvoi.
- **Administrateur muni de `access.operate` sans `events.read`** : il lit la porte. C'est voulu, `scan_scanner_authorized`
  donne ce droit de scan ; sans permission, la porte rend 403 (G2).
- **Prénom saisi en entier dans `first_name`** : `event_table_person` affiche ce qui est saisi. C'est une question de
  saisie, pas de code.
- **Poids du scanner (+890 octets)** : aucun code des écrans des tables n'est atteint par le scanner (S3). L'écart ne
  vient pas du badge (rapport du lot : `page.js` en baisse de 836 octets). Rien à corriger (décision prise).

## 6. Runs

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 707 | `aeb3ae0a5f` | Rapide (3 suites) | Statique 7/7 vert. T1, T2, T3 et T5 rouges pour la raison visée. T4, G4 et G9 tombés par erreur du test : `advanceEventTo(…, 'TERMINE')` sans `finishShift` donne `EVENT_NOT_STARTED`. Invariants : 0 violation. |
| 709 | `2216fb928f` | Rapide (trous, gardes) | T1 à T5 rouges pour la raison visée (sorties ci-dessus). G9 vert sur les 8 états. G4 rouge par erreur du test : la fiche suspendue est refusée en 403 avant la base, alors que le test attendait 409 à tort. |
| 710 | `91d92ff9e2` | Rapide (gardes) | `cv11cc-2-gardes` 15/15 vert, invariants 0 violation. Job rapide vert. |

Aucun run complet : la branche ne porte que des tests et ne sera jamais fusionnée.

## 7. Suite proposée

1. Corriger **T1** d'abord : données personnelles, règle déjà en place pour la liste des invités.
2. Corriger ensuite **T2 et T3** ensemble, par une fonction de copie unique en base.
3. Corriger **T5** : champ `deletable` lu par l'éditeur.
4. Trancher **T4** : aligner les textes, ou bien les garder et le dire dans le rapport du lot.
5. Pour chaque correctif, faire passer au vert le test rouge correspondant de `cv11cc-1-trous` sans le modifier, sauf T4
   si les textes propres aux tables sont gardés.

## 8. Corrections

Correctifs sur `lot11c/tables-organisatrice` (consigne du 26/11), décrits en détail dans `docs/lot11c-c-rapport.md`,
§ « Correctifs après contre-vérification ». Migration `20261215000002_l11cc_cv_correctifs.sql`, non appliquée. Les tests de
cette contre-vérification ont été repris dans la branche du lot par avance rapide.

**Run complet 718** (`8cf082fefd`, `run_id` 45856038044) : entièrement vert, 625 suites, e2e, responsive, budgets, mesure.

### Chaque test de l'audit au run 718

| Suite | Test | Run 718 |
|---|---|---|
| `cv11cc-1-trous` | T1 — contrôle pas encore ouvert : aucune liste | vert |
| `cv11cc-1-trous` | T1 — événement suspendu : aucune liste | vert |
| `cv11cc-1-trous` | T2 — copie refusée : rien ne reste, aucun avis, aucun changement dans l'historique | vert |
| `cv11cc-1-trous` | T3 — jamais deux réponses 200, jamais un type sans table | vert |
| `cv11cc-1-trous` | T4 — EVENT_LOCKED (terminé, annulé) et ADMIN_CANNOT_EDIT : même code et même texte | vert |
| `cv11cc-1-trous` | T5 — « Supprimer » proposé si et seulement si la suppression passe | vert |
| `cv11cc-2-gardes` | G0 — `03-verification.sql` : tous les points OK | vert |
| `cv11cc-2-gardes` | G0 — rejouée deux fois de plus, droits | vert |
| `cv11cc-2-gardes` | G1 — lecture : identité en adresse et en en-têtes ignorée | vert |
| `cv11cc-2-gardes` | G1 — copie : identité ajoutée au corps ignorée | vert |
| `cv11cc-2-gardes` | G2 — lecture : accès | vert |
| `cv11cc-2-gardes` | G2 — porte : accès | vert |
| `cv11cc-2-gardes` | G2 — aperçu, copie, affectations : accès | vert |
| `cv11cc-2-gardes` | G3 — données personnelles et identifiants | vert |
| `cv11cc-2-gardes` | G4 — copie refusée sur une cible non modifiable | vert |
| `cv11cc-2-gardes` | G5 — copie après validation : avis et historique | vert |
| `cv11cc-2-gardes` | G6 — copie refusée au 2ᵉ type (brouillon) | vert |
| `cv11cc-2-gardes` | G7 — deux copies de la même source, entrelacées | vert |
| `cv11cc-2-gardes` | G8 — formulaire et requêtes fabriquées | vert |
| `cv11cc-2-gardes` | G9 — refus lu = refus écrit (codes), tous les états | vert |
| `cv11cc-2-gardes` | G10 — badge du scanner | vert |
| `cv11cc-3-statique` | S1 — deux fonctions nouvelles | vert |
| `cv11cc-3-statique` | S1 — aucune autre instruction hors des corps | vert |
| `cv11cc-3-statique` | S1 — `search_path`, `SECURITY DEFINER`, droits | vert |
| `cv11cc-3-statique` | S2 — ordre des refus | vert |
| `cv11cc-3-statique` | S3 — aucun chemin d'import du scanner vers les écrans des tables | vert |
| `cv11cc-3-statique` | S3 — badge venu du seul champ `table` du serveur | vert |
| `cv11cc-3-statique` | S4 — chaque lecture de `ticket_categories` filtrée par `isTicketCategory` | vert |

Comptes bruts du run 718 : `cv11cc-1-trous` `# pass 6` `# fail 0` ; `cv11cc-2-gardes` `# pass 15` `# fail 0` ;
`cv11cc-3-statique` `# pass 7` `# fail 0`. Les tests rouges T1 à T5 passent au vert grâce au code.

### Trous et correctifs

| Trou | Correctif | Commits |
|---|---|---|
| T1 | `event_table_door_list` : hors de la plage, `CONTROL_CLOSED` sans donnée pour un contrôleur et pour un administrateur qui n'a que le droit de scanner ; la propriétaire et l'administration munie de `events.read` gardent la liste ; route 409 avec le message du scanner ; la page n'affiche plus rien ; le lien du scanner ne s'affiche que contrôle ouvert. | `b9f92dbe86`, `87f722a458` |
| T2, T3 | `public.event_table_copy` : une fonction, une transaction, verrou de la cible, cible vide vérifiée sous le verrou, tout ou rien ; un avis et une ligne « Plan copié depuis … » en cas de succès après validation ; plus de retrait côté serveur Next. | `b9f92dbe86`, `21f9f8201d` |
| T4 | Textes en un seul endroit (`private.event_table_refusal_message`) ; `event_table_edit_refusal`, règle unique de la lecture et de l'écriture ; même contact du support pour une fiche suspendue. Textes gardés : ceux de l'écriture. | `b9f92dbe86`, `e7bf94fb84` |
| T5 | Règle unique de la suppression (`private.event_table_type_delete_refusal`), lue par l'écran : `deletable`, `delete_refusal` ; « Retirer » ne dépend que de `deletable`. | `b9f92dbe86`, `257d858365` |

Les points du § 5 sont réglés aussi : la course pendant une copie sur un événement publié disparaît avec la transaction
unique, et l'état de vente de la source est gardé (décision).

### Passages modifiés dans les tests de cette contre-vérification

Cinq passages, chacun autorisé par l'utilisateur. Aucune assertion n'a changé.

1. `cv11cc-1-trous.test.ts`, T3 : la copie n'appelle plus `event_table_type_save`. L'entrelacement est donc accroché à
   l'appel unique.
   - Avant : `beforeRpc('event_table_type_save', [target.eventId, 'Carre T3 A'], async () => {`
   - Après : `beforeRpc('event_table_copy', [target.eventId, sourceA], async () => {`
2. `cv11cc-2-gardes.test.ts`, G7 : même raison.
   - Avant : `beforeRpc('event_table_type_save', [target.eventId, 'Carre G7'], async () => { second = await copy(owner, target.eventId, source); });`
   - Après : `beforeRpc('event_table_copy', [target.eventId, source], async () => { second = await copy(owner, target.eventId, source); });`
3. `cv11cc-2-gardes.test.ts`, G3 : la porte est lue par la propriétaire. Un contrôleur affecté hors de la plage ne reçoit
   plus de liste : c'est le correctif de T1, que G3 contredisait.
   - Avant : `['porte', (await doorList(controller, ev.eventId)).body],`
   - Après : `['porte', (await doorList(owner, ev.eventId)).body],`

   Le même contrôle, avec un contrôleur affecté **pendant** la plage, est fait dans `tests/parcours/l11cc-cv-correctifs.test.ts`
   (vert au run 718).
4. `cv11cc-2-gardes.test.ts`, G4 : la fiche suspendue est remise à VALIDE dans un `finally`. Elle laissait un événement
   publié d'une fiche suspendue, ce qui violait l'invariant w5 des autres suites de la même base (run complet 715 :
   44 suites rouges dans le lot 2).
   - Avant :

     ```ts
     const r = await copy(suspendedPartner, tgt.eventId, src);
     // Run 709 : refus 403 PARTNER_SUSPENDED avant la base (session de la partenaire suspendue) ; 409 accepté aussi
     assert.ok([403, 409].includes(r.status) && r.body.code === 'PARTNER_SUSPENDED', show(r));
     assert.equal((await tablesState(tgt.eventId)).types.length, 0, 'fiche suspendue : rien écrit');
     ```

   - Après :

     ```ts
     try {
         const r = await copy(suspendedPartner, tgt.eventId, src);
         // Run 709 : refus 403 PARTNER_SUSPENDED avant la base (session de la partenaire suspendue) ; 409 accepté aussi
         assert.ok([403, 409].includes(r.status) && r.body.code === 'PARTNER_SUSPENDED', show(r));
         assert.equal((await tablesState(tgt.eventId)).types.length, 0, 'fiche suspendue : rien écrit');
     } finally {
         const { error: back } = await service.from('partners').update({ status: 'VALIDE' }).eq('id', suspendedPartner.partnerId);
         assert.equal(back, null, back?.message);
     }
     ```

5. `cv11cc-2-gardes.test.ts`, G9 : même défaut, même correctif (run complet 717 : 44 suites rouges, invariant w5).
   - Avant : `await compare('fiche suspendue', sp, spEv.eventId);`
   - Après :

     ```ts
     try {
         await compare('fiche suspendue', sp, spEv.eventId);
     } finally {
         const { error: back } = await service.from('partners').update({ status: 'VALIDE' }).eq('id', sp.partnerId);
         assert.equal(back, null, back?.message);
     }
     ```

`cv11cc-1-trous` et `cv11cc-3-statique` ne suspendent aucune fiche (vérifié avant le run 718).

### Runs des corrections

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 713 | `03938d6daa` | rapide | T1, T2, T4, T5 verts ; T3, G7 (accroche disparue) et G3 (contredit par T1) rouges. |
| 715 | `7b8672acf6` | complet | Les tests de l'audit verts ; 65 suites d'autres lots rouges sur l'invariant w5 (G4 et un test du lot). |
| 717 | `4081936fee` | complet | 44 suites du lot 2 rouges sur w5 (G9). |
| 718 | `8cf082fefd` | complet | **Entièrement vert.** |
