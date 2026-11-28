# Contre-vérification du lot 12d — livreur, administration des commandes et finitions

Branche auditée : `origin/lot12d/livreur-admin` (`bbe9fec97`, rapport `docs/lot12d-rapport.md`), partie de `main` à
`f7bf7ad94` ; `main` n'a pas bougé depuis (aucun autre lot fusionné entre-temps : les « dernières définitions » recopiées
sont bien les dernières). Tests de la contre-vérification sur `lot12d/cv-rouges` (jamais fusionnée) : vert = attaque
bloquée, rouge = trou. Aucune migration appliquée, aucun appel au projet distant, `.env.local` et `.private/` non lus,
branche du lot non modifiée. Le rapport du lot n'a servi qu'à repérer ses affirmations ; chacune a été revérifiée dans le
code et, quand c'était possible, par un test.

| Suite | Contenu |
|---|---|
| `tests/audit/cv12d-1-trous.test.ts` | T1a, T1b, T2, T3, T5 (base locale) |
| `tests/audit/cv12d-2-gardes.test.ts` | G1 à G14 (base locale) |
| `tests/audit/cv12d-3-statique.test.ts` | T4, F1, F2, F3, S1, S2 (sans base) |
| `tests/audit/cv12d-aides.ts` | aides communes (aucun test) |

Runs (rapides, mes suites seulement) : **811** (`4378da288`), **813** (`5ca3cf986`), **814** (`798299ecd`, suite statique seule). Journaux bruts :
`ci-results/runs/<n>-<id>/` (lus par l'API GitHub et les fichiers bruts, jamais par `git fetch`).

---

## Verdict

**Livrable après correctifs courts ; aucun constat critique.** L'argent du lot tient : décision sur une absence (tout,
part, rien) calculée et arrondie par la base, jamais au-delà du payé, une seule fois sous concurrence (avec une remise
tardive, une annulation de l'équipe, une seconde décision) ; « Annuler et rembourser » une seule fois face aux annulations
du client et de la partenaire ; paiement débité pendant une fermeture remboursé une fois ; reste en espèces noté une fois,
sans écriture d'argent d'Event Village. Recopies propres (aucune ligne perdue, une seule chacune, depuis la dernière
définition), aucune route n'appelle `order_create` directement.

À corriger avant d'ouvrir le service des commandes : **T1a** (moyen : la REST donne adresse et téléphone des clients à
tout administrateur ; préexistant au 12a, mais c'est la règle que le lot affirme poser) et **T2** (le rapport du lot
affirme fermées des colonnes qui ne le sont pas). Faibles : T3 (pause contournée par le paiement), T4 (avis d'argent à
la partenaire sans email), T5 (adresse avant le départ : à confirmer). **À la fusion avec le lot avis** : F1 rend la CI
rouge (une ligne d'exemption), F2 envoie le livreur invité sur une page introuvable (une page de redirection), F3 si l'avis
fusionne d'abord. Un point d'argent à trancher par le client : **P1, qui supporte le remboursement d'une absence**
(aujourd'hui la partenaire).

| # | Gravité | Constat | Test |
|---|---|---|---|
| T1a | **Moyenne** (préexistant 12a, contredit la règle du lot) | Tout administrateur (droit `events.read` seul) lit par la REST l'adresse et le téléphone du client de toutes les commandes | `cv12d-1-trous` T1a, rouge |
| T2 | Faible | Le client lit par la REST les colonnes nouvelles d'`orders` (dont `absent_decided_by`, identifiant de l'administrateur) et l'auteur de chaque étape ; le rapport du lot affirme ces colonnes fermées | `cv12d-1-trous` T2, rouge |
| T3 | Faible | Pause contournée : une commande créée juste avant la pause se paie pendant la pause et arrive à l'établissement | `cv12d-1-trous` T3, rouge |
| T5 | Faible (à confirmer) | Le livreur lit l'adresse et les consignes du client avant son départ (le point 4 de la consigne les exclut avec le téléphone) | `cv12d-1-trous` T5, rouge |
| T4 | Faible | `ORDER_ABSENCE_DECIDED_PRO` exclu de la règle G.49 comme « petite étape », alors qu'il annonce une perte d'argent pour la partenaire | `cv12d-3-statique` T4, rouge |
| F1 | **Bloquant à la fusion** (correctif d'une ligne) | Fusion avec le lot avis : `design1b-mots` (garde-fou des mots du lot avis) devient rouge sur la recopie d'`order_create_checked` | `cv12d-3-statique` F1, rouge ; fusion locale |
| F2 | Moyenne à la fusion | Fusion avec le lot avis : le SMS d'invitation d'un livreur (B6 du lot avis) mène à `/courier/invitations`, page que le 12d ne crée pas | `cv12d-3-statique` F2, rouge |
| F3 | Faible | Le rapport du lot affirme que ses tests ne dépendent pas des numéros de migration : `migration-lot12d-rejouable` les code en dur ; renommer au-dessus du lot avis le rend rouge | `cv12d-3-statique` F3, rouge |

Aucun constat critique : aucun accès à l'argent d'autrui, aucun double remboursement, aucun code de remise lisible, aucune
fonction ouverte à `anon` ou `authenticated`. L'argent du lot (décision sur une absence, annulation par l'équipe, paiement
refusé dans une fermeture, reste en espèces) tient sous concurrence (G1 à G6, G10).

---

## Trous, par gravité

### T1a — Moyenne : adresse et téléphone du client lus par un administrateur sans `users.read`

**Attaque.** Un administrateur qui n'a que `events.read` (la liste et la fiche du lot lui répondent `FORBIDDEN`) lit avec
son propre jeton, par la REST, `orders.contact_phone` et `orders.delivery_address` de n'importe quelle commande.

**Sortie brute (run 811) :**
```
not ok 1 - T1a. REST : adresse et téléphone d'une commande lus avec le jeton d'un administrateur (events.read seul)
  error: administrateur sans users.read : la REST sert [{"id":"36d51c2f-…","contact_phone":"+221773443300",
         "delivery_address":"Villa 12, route des Almadies","client_id":"6211ccb2-…"}] (erreur : aucune)
```

**Lignes en cause.** `supabase/migrations/20261130000003_l12a_commandes_schema.sql:385-392` (règle `orders_read` :
`client_id = auth.uid() OR public.is_admin()`, sans droit) ; même chose pour `order_items` et `order_state_history`, qui
suivent la règle d'`orders` (`:396-404`). Préexistant (12a), mais la règle « nom entier, numéro et adresse seulement avec
`users.read` » que le lot pose (`order_admin_list`, `order_admin_view`, `20261228000004_l12d_administration.sql:55,135`) ne
tient que dans ses fonctions.

**Correctif proposé.** Aucun écran ne lit `orders` par la REST (vérifié : lectures serveur au rôle de service seulement,
aucun abonnement temps réel) : retirer `OR public.is_admin()` de `orders_read` (l'administration passe par
`order_admin_list` / `order_admin_view`), dans une migration du lot (recopie de la règle depuis `:385-392`). Test :
T1a vert.

**À savoir (T1b, vert pour une mauvaise raison).** `GET /api/admin/services?type=orders` (droit `events.read`) sélectionne
`*, users(first_name, last_name, email, phone)` : il servirait nom entier, email, numéro et adresse. Il ne sert rien
aujourd'hui parce qu'il est **en erreur** depuis le 12a : cinq liens `orders → users` rendent l'imbrication ambiguë
(quatre du 12a, `absent_decided_by` ajouté par le 12d) :
```
[GET /api/admin/services] {"code":"PGRST201","details":[{… "orders_absent_decided_by_fkey" …},{… "orders_cancelled_by_fkey" …},
 {… "orders_client_id_fkey" …},{… "orders_courier_user_id_fkey" …},{… "orders_onsite_recorded_by_fkey" …}],
 "hint":"Try changing 'users' to one of the following: 'users!orders_absent_decided_by_fkey', …
```
L'onglet « Commandes » de « Catalogues et services » est donc cassé (préexistant). Le jour où quelqu'un précise le lien
(`users!orders_client_id_fkey`), la fuite apparaît. Correctif : retirer `type=orders` de cette route (la page propre
`/admin/orders` du lot la remplace) ou la réserver à `users.read` avec des colonnes choisies.

### T2 — Faible : colonnes nouvelles d'`orders` et auteur des étapes lisibles par le client

**Attaque.** Le client lit, avec son jeton, `delivery_calls`, `last_call_at`, `absent_*` et surtout `absent_decided_by`
(identifiant de l'administrateur qui a décidé) de sa commande, et `order_state_history.actor_id` (identifiants de la
partenaire, du livreur, de l'administrateur). Le rapport du lot (§ « Accès contrôlés ») affirme : « anon, authenticated :
… colonnes nouvelles d'`orders`, `products`, `venues` par la REST » refusées ; son test ne contrôle que `products`
(`tests/schema/migration-lot12d-rejouable.test.ts:74-78`).

**Sortie brute (run 811) :**
```
not ok 1 - identifiant de l'administrateur qui a décidé (absent_decided_by, order_state_history.actor_id) lu par le client
  + 'orders : [{"id":"e64cdb81-…","delivery_calls":2,"last_call_at":"2026-11-28T08:07:25.680135+00:00",
     "absent_reported_at":"2026-11-28T08:07:25.694148+00:00","absent_decision":"RIEN","absent_decided_by":"7da40f54-2db9-4538-bc95-9b6515b1c22d"}]',
  + 'order_state_history : [{"to_state":"EN_ATTENTE_PAIEMENT","actor_role":"CLIENT","actor_id":"6211ccb2-…"},
     {"to_state":"ACCEPTEE","actor_role":"PARTENAIRE","actor_id":"00435b95-…"}, …
```

**Lignes en cause.** `20261228000001_l12d_schema.sql:28-35` (colonnes ajoutées à une table dont `authenticated` a le
`SELECT` de table : une colonne ajoutée est lisible, contrairement à `products`, passée en droits par colonne au 12c) ;
`20261130000003_l12a_commandes_schema.sql:407-409`.

**Correctif proposé.** Avec T1a : `REVOKE SELECT ON public.orders, public.order_state_history FROM authenticated` (aucune
lecture REST utile, voir T1a), ou droits par colonne comme au 12c (`20261224000005_l12c_cv_correctifs.sql:579-580`) sans
`absent_decided_by`, `cancelled_by`, `onsite_recorded_by`, `courier_user_id`, `code_hash`, et sans `actor_id` pour
l'historique. Corriger la phrase du rapport. Test : T2 vert.

### T3 — Faible : pause contournée par le paiement

**Attaque.** Le client crée sa commande, la partenaire pose « Plus de commandes pendant 15 minutes », le client paie : le
paiement est créé (201) et la commande arrive à l'établissement (`RECUE`) pendant la pause, avec son délai de réponse
(sans réponse : `SANS_REPONSE`, tout rendu, faute de la partenaire).

**Sortie brute (run 811) :**
```
not ok 1 - commande créée avant la pause, payée pendant la pause : paiement refusé (ORDERS_PAUSED)
  error: 'pause posée : paiement HTTP 201 {"success":true,"payment_id":"1d241677-…","status":"PENDING","amount":2100,…
```

**Lignes en cause.** La pause n'est refusée que par `order_quote` et `order_create_checked`
(`20261228000005_l12d_fermetures_pause.sql:300-381`) ; `order_payment_create` (`20261130000005_l12a_paiement.sql:120-251`)
et `order_payable_refusal` (recopiée par le lot, `20261228000005_l12d_fermetures_pause.sql:39-77`) l'ignorent.

**Correctif proposé.** Refuser le **démarrage** d'un paiement `PREMIER` pendant la pause (pas sa confirmation : un paiement
déjà débité confirmé pendant la pause doit passer, sinon le client est remboursé pour rien) : appeler
`private.order_pause_refusal(venue_id)` dans la route ou dans l'enveloppe du démarrage (`order_payment_start`, recopie
depuis `20261226000003_l12b_garde_prix.sql:109-159`). Test : T3 vert.

### T5 — Faible, à confirmer : adresse du client lue par le livreur avant le départ

**Sortie brute (run 813) :**
```
not ok 1 - commande confiée, prête, pas encore partie : ni adresse ni consignes dans le détail ni dans la journée du livreur
  error: avant « Je pars » (état PRETE) : détail : {"address":"Villa 12, route des Almadies"} ; journée : adresse du client
```

Le point 4 de la consigne dit « téléphone **et adresse** du client jamais avant le départ ni après la fin » ; le modèle
rappelé en tête ne parle que du téléphone (« téléphone du client pour le livreur seulement en route »), et le lot sert
l'adresse et les consignes dès que la commande est confiée (`20261228000002_l12d_livreur.sql:111-113` : `'address'` sans
condition d'état ; son test A1 l'exige, `tests/parcours/l12d-livreur-admin.test.ts:181`). **À trancher** : si l'adresse
doit attendre « Je pars », le correctif est une condition `o.order_state = 'EN_ROUTE'` sur `address` et `notes` pour
`v_as = 'COURIER'` (même forme que le téléphone), et la carte « Prêtes à partir » montre la zone seule.

### T4 — Faible : un avis d'argent à la partenaire traité comme une « petite étape »

**Constat.** La décision de l'équipe sur une absence rembourse le client par `order_refund_payment`, qui reprend la part
faciale **sur la partenaire** (`20261130000006_l12a_etapes.sql:88-91` : « Part de la partenaire (prix moins commission)
rendue par la partenaire »). `ORDER_ABSENCE_DECIDED_PRO` (« Le client est remboursé de X F CFA ») lui annonce donc une
perte d'argent, comme `ORDER_CANCELLED_PRO` (4 canaux) ; il n'a que cloche et notification et figure dans les 9
exclusions ajoutées à `G49_EXCLUDED` (`tests/parcours/email-regle-envoi.test.ts:74-76`).

**Sortie brute (run 811) :**
```
not ok 1 - ORDER_ABSENCE_DECIDED_PRO (remboursement repris sur la part de la partenaire) a l'email, comme ORDER_CANCELLED_PRO
  + actual - expected
  -   'EMAIL',
      'IN_APP',
      'PUSH'
```

**Correctif proposé.** `channels: ['IN_APP', 'PUSH', 'EMAIL']` pour `ORDER_ABSENCE_DECIDED_PRO` (catalogue et registre
`20261228000006_l12d_avis.sql`), retirer le type de `G49_EXCLUDED`, et dire dans le texte que la somme est reprise sur ses
ventes (voir P1). Les 8 autres exclusions sont justifiées (§ Point 6).

### F1 — Bloquant à la fusion : garde-fou des mots du lot avis

**Constat.** Le lot avis ajoute à `tests/schema/design1b-mots.test.ts` un contrôle des messages SQL de la **dernière**
définition de chaque fonction, avec une exemption **par fichier** : `'20261226000003_l12b_garde_prix.sql|ORDER_PRICE_CHANGED'`
(code interne d'une exception attrapée). Le 12d recopie `order_create_checked` dans `20261228000005_l12d_fermetures_pause.sql` :
après fusion, la dernière définition n'est plus dans le fichier exempté.

**Sortie brute (fusion locale `origin/lot12d/livreur-admin` + `origin/avis/phase2`, conflits résolus par union, suite
lancée sans base) :**
```
✖ messages SQL de la DERNIÈRE définition de chaque fonction : « message » des réponses et RAISE … MESSAGE
  + [
  +   'public.order_create_checked (20261228000005_l12d_fermetures_pause.sql) : code brut « ORDER_PRICE_CHANGED » — « ORDER_PRICE_CHANGED »'
  + ]
[DESIGN1B-MOTS] e. 644 fonctions SQL (dernière définition), 1087 messages relus ; fautes : 1
```
Sur chaque branche seule : vert (12d : 3/3 ; avis : run 799).

**Correctif proposé (à la fusion, quel que soit l'ordre).** Ajouter
`['20261228000005_l12d_fermetures_pause.sql|ORDER_PRICE_CHANGED', 'code interne de l'exception attrapée (recopie du 12d)']`
à l'exemption de `design1b-mots` (ou, mieux, rendre l'exemption indépendante du fichier : fonction + code). Test F1 :
reproduit la règle sur la branche du 12d ; vert une fois l'exemption étendue (adapter F1 à la nouvelle forme).

### F2 — Moyenne à la fusion : SMS d'invitation d'un livreur vers une page absente

**Constat.** Le lot avis (B6, `lib/notifications/catalog.ts:2136` de `avis/phase2`) envoie au livreur invité : « … vous
invite à livrer ses commandes. Répondez : https://app.eventvillage.sn/courier/invitations ». Le 12d ne crée que
`app/courier/invitations/[id]/page.tsx` ; aucune redirection (`middleware.ts`, `next.config`). Le rapport avis l'annonce
(« la page arrive avec le 12d ») ; le 12d ne l'a pas faite.

**Sortie brute :** 
```
not ok 2 - F2. le SMS d'invitation d'un livreur du lot avis (B6) mène à /courier/invitations : la page existe
  error: 'app/courier/invitations/page.tsx absente : le lien du SMS ORDER_COURIER_INVITED du lot avis tombe sur une page introuvable'
```
Sur la fusion locale : `app/courier/invitations/` ne contient que `[id]`.

**Correctif proposé.** `app/courier/invitations/page.tsx` qui redirige vers `/courier/orders` (les invitations en attente
y sont en tête), ou lien du SMS vers `/courier/orders`. `f5-liens-avis` ne contrôle pas les liens des SMS : à étendre.

### F3 — Faible : renommer les migrations du 12d casse son propre test

**Sortie brute (en local, puis run 814) :**
```
✖ F3. le test « rejouable » du lot ne dépend pas des numéros de migration (renommage au-dessus du lot avis possible)
  AssertionError [ERR_ASSERTION]: noms complets codés en dur : 20261228000001_l12d_schema.sql, 20261228000002_l12d_livreur.sql,
  20261228000003_l12d_absence_signalement.sql, 20261228000004_l12d_administration.sql, 20261228000005_l12d_fermetures_pause.sql,
  20261228000006_l12d_avis.sql
```

Le rapport du lot (§ 1) : « le test statique et le test « rejouable » repèrent les fichiers par `_l12d_`, sans dépendre des
numéros ». `tests/schema/migration-lot12d-rejouable.test.ts:35-38` exige les six noms exacts `20261228000001…006`. Si le lot
avis fusionne d'abord (et il faut alors renommer, voir § Point 8), ce test doit être modifié et signalé. Correctif :
comparer les suffixes (`_l12d_schema.sql`, …) et l'intervalle, pas les noms complets.

---

## Points à décider (pas des trous)

1. **P1 — Qui paie une absence décidée « tout » ou « une part » ?** Le remboursement reprend la part faciale sur la
   partenaire (`order_refund_payment`), alors que le plat a été préparé et que l'absence n'est pas de son fait
   (`partner_fault = FALSE`, origine `EVENT_VILLAGE`). Rien dans le modèle donné ne dit qui supporte ce remboursement ; la
   partenaire ne le voit que par « Le client est remboursé de X » (T4). À trancher : part reprise sur l'établissement,
   geste d'Event Village (part de service et faciale sur Event Village), ou choix à chaque décision.
2. **P2 — Absence jamais décidée.** Aucune relance de l'équipe ; la commande reste `EN_ROUTE` sans fin (aucune tâche ne la
   ferme) ; le livreur garde adresse et téléphone jusqu'à la décision ; les coordonnées ne sont jamais masquées
   (`order_tick` masque après `closed_at`). Voir idée 1.
3. **P3 — Cohérence avec le lot avis.** (a) Le lot avis donne la notification du téléphone à chaque avis d'administrateur
   (B8, `tests/parcours/avis2-canaux.test.ts:37-47`) ; `ADMIN_ORDER_ABSENT` et `ADMIN_ORDER_ISSUE` n'ont que cloche et email.
   (b) « Prénom et initiale » : le lot avis (C1) prend le premier mot du nom et l'initiale du dernier mot ;
   `private.order_person_short` (`20261228000002_l12d_livreur.sql:226-235`) garde tout le prénom et l'initiale du premier
   mot du nom (« Mame Diarra Ba Diallo » : avis « Mame D. », 12d « Mame Diarra B. »). Une seule règle à choisir.
4. **P4 — Texte.** Les avis de décision écrivent « Motif : Client absent : <motif> » (le motif passé à `order_close_apply`
   est préfixé, `20261228000003_l12d_absence_signalement.sql:279-280`) ; « vous étiez absent », « Vous êtes remboursé » :
   formes au masculin.

---

## Garde-fous verts

Run 813 : `cv12d-2-gardes` **14/14 vert** ; S1, S2 verts aux runs 811 et 813 ; typecheck et lint OK. Au run 811, G12
était rouge par une erreur de mon test (le 4ᵉ signalement répond 429 `TOO_MANY_ISSUES`, j'attendais 409), corrigé au 813.

| Test | Ce qui est éprouvé |
|---|---|
| G1 | Décision « tout » et remise avec le code **en même temps** : une seule passe ; remise sans remboursement, ou décision (5 250 rendus) et remise refusée |
| G2 | Décision « une part » et « Annuler et rembourser » de l'équipe en même temps : une seule passe, un seul remboursement (2 625 ou 5 250) |
| G3 | Décision après une annulation : `NO_ABSENCE`, un seul remboursement ; « tout » et « rien » en même temps : une seule décision, remboursement conforme à celle qui passe |
| G4 | 33 % de 5 261 (4 010 + 1 000 + frais 251) = 1 736 : aperçu = remboursement = `refunded_amount` ; acompte : « tout » rend 1 890 (payé en ligne), jamais le reste en espèces ; parts refusées : 0, 100, 50,5, « 1e1 », « 50 » avec espace, -1, absente, « 33% » ; montant « 1736.13 » refusé (`AMOUNT_CHANGED`) |
| G5 | Annulations du client, de la partenaire et de l'équipe en même temps : une seule passe, un remboursement (3 150) |
| G6 | Paiement débité, confirmé après une fermeture posée sur l'heure : `REFUND_REQUIRED`, **un** versement de 2 100, deuxième rappel de l'opérateur sans doublon (`REFUND_IN_PROGRESS`), commande jamais transmise |
| G7 | Pause : création par la route refusée (au plus tôt et programmée pour plus tard), aucune ligne écrite ; autre établissement de la même partenaire non touché ; commande acceptée avant la pause qui avance |
| G8 | `order_watch_tick` deux fois en même temps : un avis à l'équipe (email, cloche), un au livreur (cloche, notification), une étape |
| G9 | Deux touches « Appeler » simultanées : un appel compté |
| G10 | Reste en espèces : refusé à un autre livreur de l'équipe (404), noté par la partenaire (4 200), une fois (409 ensuite), aucun paiement, versement ni écriture du grand livre de plus |
| G11 | Remise encore possible pendant la décision de l'équipe (sortie de « À décider ») ; après la décision, remise refusée, commande `NON_RETIREE` |
| G12 | Invité non accepté : ni confié, ni lecture, ni appel ; signalement par le livreur 404 ; 4ᵉ signalement 429 `TOO_MANY_ISSUES` ; remise depuis 49 h : `ISSUE_TOO_LATE`, 47 h : accepté |
| G13 | REST, clé anon et jeton d'un client : `products.allergens/spice_level`, `order_issues`, `order_closure_keeps`, `venues.orders_paused_*` refusés |
| G14 | « Garder » une commande d'un autre établissement de la même partenaire : 404, rien écrit |
| S1 | Aucune route ni module n'appelle `order_create` ou `order_quote_compute` directement (seulement `order_create_checked`, `order_quote`) : la pause ne se contourne pas par une autre route |
| S2 | Six recopies, une fois chacune, depuis la dernière définition (`main` = base du lot) ; lignes perdues : 0, sauf les 2 lignes d'`order_view` déclarées remplacées (téléphone du livreur, adresse de l'établissement) |

Contrôles du lot revérifiés dans le code et confirmés (sans test de plus) : code de remise jamais rendu (empreinte HMAC
avec clé secrète, `20261130000003_l12a_commandes_schema.sql:177-186`) ; fonctions publiques du lot au rôle de service seul ;
`courier_active` de `/api/auth/me` : un booléen, rien d'autre (`app/api/auth/me/route.ts`) ; droits de l'administration
par `admin_can` (règle 1B.8) dans toutes les fonctions nouvelles.

---

## Points écartés après vérification

- **Fermeture et commande « au plus tôt »** : `scheduled_for` est toujours rempli (maintenant + préparation + 1 min,
  `20261224000003…:241-243`) ; le refus du paiement et la liste des commandes prévues s'appliquent aussi.
- **Fermeture modifiée après coup** : une fermeture ne se modifie pas, elle s'annule (`venue_closure_delete`) ; le
  déclencheur `AFTER INSERT` suffit.
- **Interblocage de `order_watch_tick`** : verrou de l'établissement puis ligne de la commande, même ordre que
  `order_delivery_step`, `order_absence_decide` et la remise ; la pause par `SKIP LOCKED`.
- **Téléphone gardé par le livreur pendant la décision de l'équipe** : voulu (la remise reste possible si le client
  rappelle) ; à revoir avec P2.
- **`order_cancel` et `has_admin_permission` (lit `users.role`)** : préexistant (12a) ; échoue fermé (refus), la route
  vérifie aussi `refunds.manage`.
- **« Annuler et rembourser » sans montant écrit** : la consigne ne l'exige que pour la décision sur une absence ; le
  bouton écrit le montant servi par la base.
- **Avis : données sans adresse ni téléphone** (`order_notif_data`), prénom et initiale dans `ORDER_COURIER_ANSWERED`
  (test A3 du lot), SMS d'un segment au pire cas (`avis2-sms-pire-cas` 21/21 et `cv12a-3-statique` 3/3 sur la fusion
  locale), liens vers des écrans existants (`/partner/orders/livreurs`, `/courier/orders`, fermetures, `/admin/orders/<id>` :
  pages présentes ; `f5-liens-avis` 7/7 sur la fusion locale).
- **`order_quote_compute` non recopiée** : raison du lot exacte (`tests/audit/cv12c-3-statique.test.ts` S1) ; la pause tient
  par les deux enveloppes (G7, S1).

---

## Point 6 — avis : les 9 exclusions de G.49, une à une

| Type | Destinataire | Petite étape ? |
|---|---|---|
| `ORDER_COURIER_ANSWERED` | partenaire | oui : réponse à une invitation qu'elle vient d'envoyer, visible dans ses livreurs |
| `ORDER_COURIER_REMOVED` | livreur | oui : plus aucune commande confiée ; aucune action ni argent |
| `ORDER_COURIER_RETURN` | livreur | oui : consigne immédiate pendant la livraison (part la nuit) ; l'email arriverait trop tard pour servir |
| `ORDER_CLIENT_ABSENT_PRO` | partenaire | oui : information pendant la livraison ; la décision lui est annoncée ensuite |
| `ORDER_ABSENCE_DECIDED_PRO` | partenaire | **non** : remboursement repris sur sa part (T4) |
| `ORDER_ISSUE_PRO` | partenaire | oui : l'équipe traite ; aucune action ni argent demandé à la partenaire |
| `ORDER_ISSUE_CLOSED` | client | oui : la réponse est dans la commande ; aucun argent (aucun remboursement automatique) |
| `ORDER_CLOSURE_ORDERS` | partenaire | oui : conséquence immédiate de la fermeture qu'elle vient de poser, à l'écran où elle est |
| `ORDER_PAUSE_ENDED` | partenaire | oui : fin d'une pause qu'elle a posée |

---

## Point 7 — tests existants modifiés (avant / après)

| Fichier | Lignes retirées | Verdict |
|---|---|---|
| `tests/parcours/notif-modeles.test.ts` | 0 (21 ajoutées : G2, G3) | aucune assertion affaiblie |
| `tests/parcours/notif-outbox.test.ts` | 0 (14 ajoutées : registre) | aucune assertion affaiblie |
| `tests/parcours/email-regle-envoi.test.ts` | 1 (`G49_EXCLUDED`) | règle **élargie à 9 exclusions** : 8 justifiées, 1 non (T4) |
| `tests/schema/f3b-ecrans.test.ts` | 3 (listes du menu) | listes attendues complétées de `/admin/orders` ; rien retiré |
| `tests/helpers/design-files.ts`, `e2e/support/responsive-pages.ts` | 0 | écrans ajoutés au contrôle |
| `docs/recette-billetterie.md` | 3 (références) | `email-regle-envoi :121→125, :315→319, :536→540`, `notif-modeles :593→607` : mêmes lignes de code, contrôlé un à un |

`tests/audit/` et `tests/audit-auth/` : aucune ligne changée par le lot (vérifié par `git diff`).

---

## Point 8 — compatibilité avec le lot « Avis » phase 2 (`origin/avis/phase2`, `1dc25b2f7`, non fusionné)

Fusion simulée localement (`git merge-tree`, puis fusion dans un dossier jetable, jamais poussée) :

- **Conflits textuels (4)** : `tests/parcours/email-regle-envoi.test.ts` (`G49_EXCLUDED` des deux côtés : union),
  `tests/parcours/notif-modeles.test.ts` et `tests/parcours/notif-outbox.test.ts` (ligne `ADMIN_PRODUCTS_REVIEW_BATCH`
  changée par l'avis, B8, juste avant les ajouts du 12d : garder la ligne de l'avis puis les 13 lignes du 12d),
  `docs/recette-billetterie.md` (références de lignes recalées par les deux : à recalculer, `recette-matrice` 8.3 a rouge
  sur la fusion). `lib/notifications/catalog.ts`, `catalog-types.ts`, `outbox-labels.ts` fusionnent **sans** conflit
  (le rapport du 12d en annonçait).
- **Fonctions recopiées par les deux** : aucune (27 fonctions définies par le 12d dont 6 recopies, 27 par l'avis, intersection vide ; ni
  `order_courier_action` ni `order_courier_remove` touchées par le 12d).
- **Ruptures à la fusion, dans les deux ordres** : F1 (`design1b-mots` rouge) et F2 (page `/courier/invitations`).
- **Ordre des migrations** : 12d d'abord (`20261228` < `20261230`) : rien à renommer ; avis d'abord (et appliqué sur
  event-village-dev) : les migrations du 12d tomberaient avant la dernière appliquée (refus de `supabase db push` sans
  `--include-all`) → les renommer au-dessus de `20261230000006`, **et** modifier `migration-lot12d-rejouable` (F3). Le
  contrôle de l'avis (`migration-avis2-rejouable`, recopies « depuis la dernière définition avant `20261230` ») n'est pas
  gêné : aucune fonction commune.
- **Suites statiques sur la fusion locale** : `l12d-statique` 6/6, `f5-liens-avis` 7/7, `avis2-sms-pire-cas` 21/21,
  `l12c-statique` 6/6, `cv12a-3-statique` 3/3, `cv12c-3-statique` 9/9, `f4-textes` 159/159 ; `design1b-mots` 1 rouge (F1) ;
  `recette-matrice` 1 rouge (références) ; suites à base (`notif-modeles` registre, `notif-outbox`, `email-regle-envoi`,
  `avis2-*`) non lancées (pas de base locale) : à passer au run complet de la fusion.
- **Cohérence** : P3 (notification du téléphone des avis d'administrateur, règle « prénom et initiale »).

---

## Idées pour le livreur et l'équipe (classées par valeur)

1. **Échéance et relance de la file « À décider »** : une absence ou un signalement sans réponse depuis 1 h relance les
   administrateurs `refunds.manage` (email et notification), au bout de 4 h le super-administrateur ; compteur sur le
   tableau de bord. Aujourd'hui l'argent du client et la commande restent bloqués sans fin (P2).
2. **Remboursement d'une part après la remise** : sur un signalement « commande incomplète » ou « erreur », l'équipe rend
   une ligne ou une part d'une commande remise (même moteur, montant écrit exigé comme pour l'absence). « Annuler et
   rembourser » refuse une commande remise : le cas le plus fréquent n'a pas d'outil.
3. **« Qui paie » dans la décision** : choix explicite entre « repris sur l'établissement » et « geste d'Event Village »,
   montant écrit à la partenaire par email (P1, T4) ; moins de litiges avec les établissements.
4. **« Commande rapportée » confirmée par l'établissement** : après « Rapportez la commande », la partenaire confirme le
   retour ; la livraison sort de la liste du livreur, ses coordonnées (adresse, téléphone) lui sont masquées, l'équipe
   sait que le plat est revenu avant de décider.
5. **Preuve des appels pour le client** : « Le livreur vous a appelé à 13 h 02 et 13 h 03 » dans le suivi et dans la
   fiche de l'équipe (heures déjà comptées en base, `ORDER_CLIENT_CALLED`) ; réponse immédiate à « personne ne m'a
   appelé ».
6. **Caisse du jour du livreur** : espèces encaissées par établissement (montants servis par la base), « Espèces
   remises » confirmé par la partenaire, écart signalé à l'équipe.
7. **Réponses types** pour la décision et pour les signalements, avec aperçu du SMS rendu (un segment), pour aller plus
   vite et garder un ton constant.

---

## Remise en état

Chaque test remet ce qu'il modifie : pauses levées (`minutes: 0`), fermetures annulées (`cancelled_at`), commandes
ouvertes annulées par la partenaire, commandes non payées closes, signalements traités, invitation retirée ; base de la CI
jetable de toute façon. Aucune fiche, aucun réglage de la plateforme changé hors du service des commandes ouvert le
temps des suites (`openOrdersService`, valeur d'origine remise). Dossiers retirés à la fin : jonctions `node_modules`
(`cmd /c rmdir`), puis `event-village-cv12d` et le dossier jetable de la fusion.
