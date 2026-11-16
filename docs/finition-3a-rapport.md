# Finition 3a — Argent de l'administration

Branche `finition-3a/argent`, partie de `main` à `c248e17f`, dans son propre dossier (`event-village-finition3a`, `node_modules` propre, aucune jonction). `main` (finition 2a fusionnée, `fb3dcbcd6`) y est fusionné avant le run « après », sans conflit. **Rien n'est fusionné dans `main`.** Migrations `20261117000001` à `…04`, sans BEGIN ni COMMIT, rejouables, appliquées après les `20261116…`.

## À lire en premier

### 1. Sécurité d'abord : deux trous fermés, chacun avec un test rouge puis vert

1. **Le journal d'audit sortait par les indicateurs.** `GET /api/admin/metrics` (permission « Consulter les statistiques ») renvoyait les 10 dernières lignes du journal (`recentAuditLogs` : action, objet, rôle, compte), alors que le journal est réservé au SUPERADMIN. La route ne lit plus `audit_logs` ; la réponse n'en porte plus aucune ligne, pour personne.
2. **Deux fonctions d'administration faisaient confiance à la route.**
   - `partner_status_set` n'exigeait qu'un rôle ADMIN : un ADMIN sans « Valider les partenaires » pouvait valider, refuser ou réactiver, et un ADMIN suspendre, si une route l'appelait sans contrôle. La base exige désormais `partners.validate` pour valider, refuser ou réactiver, et le SUPERADMIN pour suspendre (comme la route depuis le lot 9 quater).
   - `admin_permissions_set` ne vérifiait pas l'auteur et lisait la cible dans l'ancienne colonne `users.role`. La base exige un SUPERADMIN au compte actif et lit la cible dans `user_roles` : un SUPERADMIN ne reçoit pas de droits, un compte sans rôle ADMIN non plus (nouveau refus `TARGET_NOT_ADMIN`, 400).
   - Ces fonctions ne sont appelables que par le serveur : l'« attaque » testée est l'appel qu'une route ferait sans contrôler l'auteur. Rien ne change (statut, compte, journal, droits).

**Preuves, CI en mode rapide** (détail au § Runs) :
- **Runs 241 et 242 :** `f3a-securite` rouge, 14 tests sur 16. La route renvoyait le journal, et les deux fonctions acceptaient chaque appel d'attaque. Seuls passaient les deux témoins, qui font des actions permises. Au 241, un des rouges l'était pour une mauvaise raison, corrigée au 242.
- **Run 243 :** correctifs. 15 tests sur 16 : le dernier rouge venait de mon message d'assertion, pas de la règle. Les huit suites voisines sont vertes :
  - droits du lot 9 quater ;
  - fiche partenaire ;
  - `tests/audit/aud-06-partenaire-suspendu` ;
  - journal transactionnel ;
  - écritures ignorées ;
  - avis aux pros ;
  - argent hors plateforme ;
  - privilèges des fonctions.
- **Run 244 :** 16 sur 16.
- **Run 252, complet :** `f3a-securite` vert. Sur les 31 suites de `tests/audit/` et `tests/audit-auth/`, 30 sont vertes. La rouge, `tests/audit/cvf2a-3-recherche`, porte sur la cadence vers le service de cartes de la finition 2a : ce n'est pas une faille, voir § Runs.

### 2. Ce que voit l'administration

- **Page Finance** (`/admin/finance`), de haut en bas :
  - une seule **période** pour toute la page : Aujourd'hui, 7 derniers jours, 30 derniers jours, Ce mois-ci (par défaut), Mois dernier, Dates choisies (du … au …). Le serveur calcule les bornes en heure de Dakar et écrit la phrase des dates (« du 1er au 16 novembre 2026 ») ; la période est gardée dans l'adresse ;
  - **quatre chiffres**, chacun avec une phrase simple, la date qu'il utilise et un lien vers son détail : « Gagné par Event Village » (sur la période), « Dû aux partenaires » (à l'instant, avec la part retirable aujourd'hui et le dû aux parrains), « Retirable par Event Village » (SUPERADMIN seulement, avec l'heure de lecture du solde) et « Créances » (bloc à part) ;
  - l'argent qui attend : versements à reprendre (inchangé, avec son ancre), **remboursements à verser** (nouveau), **créances** (qui, pourquoi, depuis quand, reste dû) ;
  - le détail : ce qui a été gagné (lignes signées qui s'additionnent au total), le dû compte par compte (partenaires puis parrains), le calcul du retirable (solde − tout ce qui est dû − réserve de prudence) ;
  - les **paiements encaissés**, 20 par page (pages calculées par le serveur), statut en français ; le filtre de statut ne change que cette liste.
- **Accueil de l'administration** : bloc **« Argent qui attend »** en tête, avant « À traiter » (versements à reprendre, remboursements à verser, créances), chaque ligne avec un bouton qui mène à sa liste. Un seul revenu : **« Gagné par Event Village », ce mois-ci**, avec le même calcul que la page Finance.
- **Avis de l'administration** : ils mènent à la bonne liste (`#versements-a-reprendre`, `#remboursements-a-verser`, `#creances`, `#du-aux-partenaires`), et la page défile jusqu'à elle.
- **Réglages de la plateforme** (bouton en haut de la page Finance, ou lien « Changer la réserve de prudence » sous « Calcul de ce qui est retirable ») : « Réserve de prudence » (« Automatique : encaissements des 3 derniers jours » ou « Montant fixe ») et « Montant fixe de la réserve de prudence », expliqués.

### 3. Les trois chiffres : formules exactes

Une seule source de calcul, en base : `finance_admin_earned` et `finance_admin_summary` (migration `…03`). L'écran ne calcule rien.

**Gagné par Event Village sur la période** (chaque nature d'opération a sa date) :

```
Gagné = Σ paiements en ligne encaissés de la période (date : encaissé le)
          (frais de service − frais d'encaissement SamirPay estimés − part annulée par les remboursements
           + retenue d'un paiement en double)
      + Σ frais de retrait des retraits versés de la période (date : versé le)
      − Σ frais SamirPay réels des versements confirmés de la période (date : confirmé le)
      + Σ frais repris aux partenaires sur ces versements, déjà récupérés
      − Σ commissions de parrainage de ces paiements (annulées exclues, régularisations déduites)
      − Σ commissions reprises mais pas encore récupérées (créance du parrain sur ces paiements)
```

**Dû aux partenaires** (à l'instant) = Σ grand livre des partenaires + Σ net des retraits en attente ou en cours. Le solde d'un compte n'est jamais négatif (ce qui dépasse devient une créance) : la somme ne cache donc rien. **Dû aux parrains** : même calcul pour les comptes de parrainage.

**Retirable par Event Village** (SUPERADMIN, à l'instant) = max(0, solde SamirPay − dû aux partenaires − dû aux parrains − remboursements à verser − réserve de prudence). S'il y a un manque, il est affiché à part. Si le solde est illisible, aucun chiffre n'est affiché.

**Créances** = Σ reste dû des créances ouvertes. Bloc à part, jamais soustrait.

**Exemple chiffré.** C'est celui du test de bout en bout par le vrai moteur (`f3a-routes`) : frais de service 5 %, agrégateur Wave 1,5 %, frais de retrait 1 %, agrégateur d'une annulation à la charge de l'organisatrice.

| Opération | Gagné | Dû aux partenaires |
|---|---|---|
| Achat de 2 billets à 10 000 F : payé 21 000, frais de service 1 000, agrégateur 315 | + 685 | + 20 000 |
| Un billet remboursé : 10 500 rendus ; part annulée 500 − 157,50 | − 342,50 | − 10 157,50 |
| Versement du remboursement : frais SamirPay réels 157,50 | − 157,50 | 0 |
| Retrait de 5 000 par la partenaire : frais de retrait 50, net versé 4 950 | + 50 | − 5 000 |
| Versement du retrait : frais SamirPay réels 74,25 | − 74,25 | 0 |
| **Total** | **160,75** | **4 842,50** |

Le compte SamirPay a reçu 21 000 − 315 et versé 10 500 + 157,50 + 4 950 + 74,25 : il reste 5 003,25.
- **Avec une réserve de 0**, le retirable vaut 5 003,25 − 4 842,50 = **160,75**, exactement le gagné. Sans remboursement en attente ni réserve, Event Village peut sortir ce qu'il a gagné, pas plus.
- **Avec la réserve automatique** (encaissements des 3 derniers jours : 21 000), le retirable est **0**. La page affiche « Rien n’est retirable pour le moment : l’argent du compte est dû aux partenaires et aux clients. », avec un manque de 20 839,25.

**Preuve sans double comptage** (`f3a-synthese`). Les cas sont construits à la main dans une transaction annulée, sur une fenêtre isolée de mars 2001 :
- paiement simple et sa commission ;
- remboursement total, et remboursement partiel avec sa commission recalculée ;
- commission versée puis régularisée, avec 10 F non récupérés ;
- 3e paiement en double, avec retenue ;
- retrait versé ;
- frais repris en entier, puis frais passés en créance et récupérés en partie ;
- paiements, versements et retraits qui doivent rester hors calcul.

Gagné attendu : **522,62** = 712,50 + 100 − 418,50 − 51,38 − 10 + 190, obtenu au centime.

À la fin de chaque suite de la finition, un recalcul indépendant (paiement par paiement, sans jointure) refait « Gagné depuis le début » et les chiffres à l'instant. Il doit donner exactement la même chose sur toute la base de test (invariants g1 et g2).

## Textes nouveaux

Écrans (phrases exactes) :
- « Rien n’est retirable pour le moment : l’argent du compte est dû aux partenaires et aux clients. » ; avec un manque : « Le compte SamirPay ne couvre pas tout ce qui est dû : il manque {montant}. Ne retirez rien : des versements risquent de se bloquer. »
- « Solde SamirPay illisible pour le moment. Ne retirez rien avant qu’il s’affiche. » ; « Solde SamirPay lu à {heure}, moins tout ce qui est dû et la réserve de prudence. » ; en mode d'essai : « Mode d’essai : chiffre sans valeur réelle. » sur la carte, et dans le calcul le bandeau « Mode d’essai » : « Chiffres sans valeur réelle : le solde vient du faux service de paiement. »
- « En attendant la confirmation du délai de SamirPay, une réserve est gardée sur le compte. », suivi de « Automatique : les encaissements des 3 derniers jours, soit {montant} aujourd’hui. » ou de « Montant fixe choisi par le Superadmin : {montant}. »
- Phrases des chiffres :
  - « Ce qui reste à Event Village une fois payés SamirPay et les parrains : frais de service et frais de retrait, remboursements déduits. »
  - « L’argent des ventes qui appartient aux partenaires : il est sur le compte SamirPay, mais il n’est pas à Event Village. »
  - « Ce que vous pouvez sortir du compte SamirPay sans empêcher un partenaire, un parrain ou un client d’être payé. »
  - « Ce que des partenaires ou des parrains doivent encore à Event Village, repris sur leurs prochains gains. Ce n’est déduit d’aucun autre chiffre. »
- Période : « Période affichée : {du … au …}. Elle change « Gagné par Event Village » et la liste des paiements ; les autres chiffres sont à l’instant. »
- Statuts de paiement : « Payé », « Remboursé en partie », « Remboursement en cours », « Remboursé », « Statut inconnu » (mêmes mots dans le filtre) ; « Écart de {montant} ».
- Remboursements à verser : « En attente d’envoi », « Envoyé, en attente de confirmation », « Issue incertaine : à vérifier », « Refusé par l’opérateur : à renvoyer », « Non versé (constaté avec le support SamirPay) », « Bloqué : à reprendre » ; lien « Traiter dans « Versements à reprendre » ».
- Créances : « Frais SamirPay d’un remboursement », « Commission de parrainage reprise après un remboursement », « Remboursement avancé par Event Village », « Autre somme due » ; liste vide : « Personne ne doit d’argent à Event Village. »
- Accueil :
  - titre « Argent qui attend » ;
  - « {n} versement(s) à reprendre » — « {montant} que des clients ou des partenaires attendent depuis plus de 30 minutes. » — bouton « Traiter les versements » ;
  - « {n} remboursement(s) à verser » — bouton « Voir les remboursements » ;
  - « {n} créance(s) » — bouton « Voir les créances » ;
  - ligne à jour : « Versements à reprendre : aucun »… ;
  - panne : « Compteur indisponible pour le moment. » (jamais 0) ;
  - carte « Gagné par Event Village » — « Ce mois-ci, du 1er au 16 novembre 2026. Détail sur la page Finance. »
- Sans la permission « Consulter les paiements » : « Votre compte n’a pas la permission « Consulter les paiements ». Demandez-la au Superadmin pour voir ce que gagne Event Village et ce qui est dû. »

Refus du serveur :
- « Seul un Superadmin peut suspendre une partenaire. »
- « Action non autorisée : votre compte n’a pas la permission « Valider les partenaires ». »
- « Seul un Superadmin actif modifie les droits d’un administrateur. »
- « Ce compte n’est pas administrateur : ses droits ne se règlent pas ici. »
- Périodes : « Période inconnue. Choisissez une période dans la liste. », « La date de début doit précéder la date de fin. », « La date de fin ne peut pas dépasser aujourd’hui. », « Choisissez au plus 366 jours. ».

## Migrations

| Fichier | Contenu |
|---|---|
| `20261117000001_f3a_securite.sql` | Recopies de `partner_status_set` (permission de l'auteur) et de `admin_permissions_set` (SUPERADMIN actif, cible lue dans `user_roles`). Seules les lignes marquées « Finition 3a (1b) » changent. |
| `20261117000002_f3a_reserve.sql` | Réglages `finance.safety_reserve_mode` (AUTO_3_DAYS) et `finance.safety_reserve_amount` (0), jamais écrasés ; recopies de `fin_setting_valid` et de `finance_setting_set` avec ces deux clés seulement. |
| `20261117000003_f3a_synthese.sql` | `finance_admin_earned`, `finance_admin_summary`, `finance_admin_payments`, `finance_admin_debts`, `finance_admin_refunds_to_pay`, `finance_admin_owed`, `finance_admin_waiting` ; cinq index de lecture par date. |
| `20261117000004_f3a_solde.sql` | Table `samirpay_balance_reads` (RLS, aucun droit pour anon ni authenticated), `finance_balance_cached`, `finance_balance_record` (lectures gardées 90 jours). |

Toutes les fonctions sont en SECURITY DEFINER, avec un `search_path` fixé, et seul le rôle de service peut les exécuter. Aucune fonction recopiée par la finition 2a n'est touchée. Aucune donnée existante n'est modifiée.

## Contrôles avant et après (event-village-dev, lecture seule)

Requêtes à lancer toi-même dans l'éditeur SQL (lecture seule). Rien n'a été exécuté contre le projet distant.

```sql
-- Avant
-- A. Dernière migration appliquée : 20261116000008 attendu (la finition 2a d'abord)
select max(version) from supabase_migrations.schema_migrations;
-- B. Fonctions de la finition absentes : 0 ligne
select proname from pg_proc where pronamespace = 'public'::regnamespace and proname in
  ('finance_admin_earned','finance_admin_summary','finance_admin_payments','finance_admin_debts','finance_admin_refunds_to_pay',
   'finance_admin_owed','finance_admin_waiting','finance_balance_cached','finance_balance_record');
-- C. Réglages de la réserve absents : 0 ligne
select key from public.platform_settings where key like 'finance.safety_reserve%';
-- D. Aucun compte du grand livre négatif (sinon « Dû aux partenaires » serait faux) : 0 ligne
select owner_id, account_kind, sum(amount) from public.finance_ledger group by 1, 2 having sum(amount) < 0;

-- Après
-- A. Quatre versions 20261117000001 à …04
select version from supabase_migrations.schema_migrations where version like '20261117%' order by 1;
-- B. Onze fonctions réservées au rôle de service : anon false, authenticated false, service_role true
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
       has_function_privilege('service_role', p.oid, 'execute') as service_role
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.proname in
  ('finance_admin_earned','finance_admin_summary','finance_admin_payments','finance_admin_debts','finance_admin_refunds_to_pay',
   'finance_admin_owed','finance_admin_waiting','finance_balance_cached','finance_balance_record','partner_status_set','admin_permissions_set')
 order by 1;
-- C. Réglages : AUTO_3_DAYS et 0
select key, value from public.platform_settings where key like 'finance.safety_reserve%' order by 1;
-- D. Cache du solde : RLS active (true), vide (0), aucun droit (false, false)
select relrowsecurity from pg_class where oid = 'public.samirpay_balance_reads'::regclass;
select count(*) from public.samirpay_balance_reads;
select has_table_privilege('anon', 'public.samirpay_balance_reads', 'select') as anon,
       has_table_privilege('authenticated', 'public.samirpay_balance_reads', 'select') as authenticated;
-- E. Synthèse du mois lisible, sans erreur
select jsonb_pretty(public.finance_admin_summary(date_trunc('month', now() at time zone 'Africa/Dakar') at time zone 'Africa/Dakar', now()));
```

**F. Recalcul indépendant** (invariants g1 et g2) : lancer la requête `FINITION3A_INVARIANT_SQL` de `tests/helpers/finition3a-invariants.ts` sans sa dernière règle (g3). Elle doit rendre 0 ligne. Elle lit tout et n'écrit rien.

## Runs

Tous les runs de la branche, dans l'ordre. Les runs 245, 247 et 253 à 257 sont ceux d'autres branches. Les journaux bruts sont sur la branche `ci-results`, dans `runs/<numéro>-<identifiant>/`. Un run rapide (ligne `ci-rapide:` dans le message du commit) dure de 2 min 30 à 4 min.

| Run | Mode | Ce qui tournait | Résultat |
|---|---|---|---|
| 241 | rapide | sécurité, migrations rejouables | rouge attendu : 14 sur 16, et migrations absentes ; un rouge pour une mauvaise raison |
| 242 | rapide | idem | rouge attendu, pour les bonnes raisons |
| 243 | rapide | idem, plus 8 suites voisines | correctifs : 9 suites sur 10 ; 1 rouge dû à mon message d'assertion |
| 244 | rapide | sécurité, synthèse, migrations rejouables | sécurité 16 sur 16 ; synthèse et migrations rejouables rouges attendus (fonctions et fichiers absents) |
| 246 | rapide | synthèse, plus 7 suites voisines (privilèges, RLS, réglages, versements) | 7 sur 8 ; synthèse 11 sur 12 (mon attendu était faux) |
| 248 | rapide | routes, périodes, liens des avis, synthèse, argent hors plateforme | synthèse 12 sur 12 ; routes, périodes et liens des avis rouges attendus (fichiers absents, typecheck rouge) |
| 249 | rapide | 11 suites (routes, périodes, avis, remboursements, moteur, textes) | vert, 11 sur 11 |
| 250 | rapide | écrans, périodes et libellés | rouge attendu (écrans absents, typecheck rouge) |
| 251 | rapide, après la fusion de `main` | 19 suites, dont les migrations rejouables de la 2a et de la 3a, les migrations gelées et les écrans de la 2a | vert, 19 sur 19. La remise à zéro applique les 8 migrations `20261116…` de la 2a, puis les 4 `20261117…` |
| 252 | **complet** | toutes les suites, puis mesure, essais e2e et captures | 440 suites sur 442. Les deux rouges sont hors de la 3a (voir ci-dessous). Mesure, essais e2e (fumée, recette, terrain) et captures verts ; invariants de la recette à 0 ; budgets JS tenus sans relèvement (« / » : 226 266 octets pour 226 342). Durée : 78 min (limite : 90). |
| 258 | rapide | `f3a-securite`, `f3a-synthese`, `f3a-routes`, puis les deux suites rouges du 252, dans l'ordre du run complet | vert : l'étape « Vérification rapide » réussit (typecheck, lint, 5 suites sur 5). Le job n'est marqué rouge que parce que la publication de ses journaux sur `ci-results` a échoué, au même moment que celle du run 257 d'une autre branche. Ses journaux bruts n'y sont donc pas ; seul GitHub Actions garde le détail des étapes. |

**Les deux rouges du run 252.** Elles étaient vertes aux sept runs complets précédents (233 à 239). La 3a ne touche ni à leur code ni à leurs tests.
- **`tests/audit/cvf2a-3-recherche`** (finition 2a), test « jamais plus d'une requête par seconde vers le service de cartes ». Écarts mesurés entre les appels : 801, 1 102 et 1 104 ms. Le limiteur espace de 1,1 s les réservations de créneau (`place_search_slot`), pas les appels eux-mêmes. Un appel servi sans attente est parti environ 0,3 s en retard, et l'appel suivant, lui, est parti à l'heure. Ce n'est pas une faille : la règle « une requête par seconde » est celle du service de cartes. Le correctif proposé est noté dans l'après-lancement pour la 2a.
- **`tests/parcours/notif-envoyeur`**, route du cron des avis : le SMS dû du test n'a pas été envoyé par le passage de la route. Le test vide d'abord la file laissée par les suites précédentes, mais seulement tant qu'un passage réserve au moins 1 000 lignes. Un passage qui examine des lignes sans les réserver, ou qui s'arrête à 45 s, arrête donc le vidage trop tôt. La 3a ne change que les liens de six avis de l'administration. C'est noté dans l'après-lancement.

**Conclusion.** Rejouées seules dans le même ordre, juste après les suites de la 3a qui écrivent en base, les deux suites passent (run 258). Leur échec au run 252 dépend de la charge du serveur et de la file laissée par plus de 200 suites, pas du code de la 3a. Je n'ai pas relancé de second run complet, pour respecter la consigne d'une seule CI complète. Pour un run complet entièrement vert avant la fusion, il suffit de pousser un commit sans ligne `ci-rapide:`.

**Captures relues** (9 nouvelles × 390 et 1440 px × clair et sombre) : les quatre chiffres, retirable (calcul juste au centime), « Rien n’est retirable… », solde illisible, détail du gagné, créances, paiements (statuts « Payé », « Remboursé en partie », « Remboursement en cours »), « Argent qui attend » sur l'accueil. Les captures de la page Finance utilisent des chiffres simulés pour montrer chaque état. Sur l'accueil, le bloc « Argent qui attend » est simulé lui aussi, mais la carte « Gagné par Event Village » lit la base des essais : son montant diffère donc de celui de la page Finance.

## Tests existants modifiés (signalés)

Aucune assertion d'un test existant n'est affaiblie.
- **`tests/parcours/notif-modeles.test.ts`** (6 lignes) et **`tests/parcours/notif-admins.test.ts`** (3 lignes) : les liens attendus des avis de l'administration portent désormais leur ancre (`/admin/finance#versements-a-reprendre`, `#remboursements-a-verser`, `#du-aux-partenaires`, `#creances`). Ils ont été modifiés d'abord, rouges au run 248, puis le catalogue a suivi.
- **`tests/security/r3-fonctions-rpc.test.ts`** : bloc ajouté pour les neuf fonctions de la finition (existent, refusées à anon et à un compte, 42501). C'est un garde-fou ajouté après les migrations : il est vert dès l'écriture.
- **`tests/helpers/design-files.ts`** : neuf fichiers ajoutés à la liste du système de design (la page Finance et ses huit composants), au milieu de la liste.
- **`e2e/support/screens.ts`** : neuf captures ajoutées ; aucune existante n'est modifiée.
- Inchangés, mais vérifiés : `finance-hors-plateforme` (les clés `netRevenue` et `totalVolume` de `/api/admin/metrics` sont gardées, avec les mêmes écarts : + 1 050 et + 34,25), `admin-remboursements` (la page rend toujours `RefundsToRetry`), `design-systeme` (deux usages exacts de la police à chasse fixe, sur la référence de la transaction).
- Suites nouvelles :
  - `f3a-securite`, `f3a-synthese` et `f3a-routes` (avec base) ;
  - `f3a-periode-libelles` et `f3a-ecrans` (sans base : aucune écriture, donc aucun appel d'invariants, écart signalé) ;
  - `migration-finition3a-rejouable` ;
  - aide `tests/helpers/finition3a-invariants.ts` (g1 à g3, après toutes les règles des livraisons précédentes).

## Décisions prises, à relire

1. **Dû aux parrains déduit du retirable.** La consigne citait seulement le dû aux partenaires. Mais les commissions non retirées sont aussi sur le compte et n'appartiennent pas à Event Village : les oublier gonflerait le retirable. Elles ont leur ligne dans le calcul.
2. **Réserve de prudence en deux réglages** : le mode (automatique, ou montant fixe) et le montant fixe. Un seul réglage ne pouvait pas dire « automatique » sans valeur spéciale.
3. **« Gagné » ne compte que ce qui est récupéré.** Une commission reprise que le parrain doit encore, ou des frais repris à une partenaire mais passés en créance, restent un coût tant qu'ils ne sont pas récupérés. Ils apparaissent aussi dans « Créances », qui n'est soustraite de rien. À la récupération, le gagné de la période d'origine remonte.
4. **Une date par nature d'opération** : encaissé le (paiements, commissions, remboursements rattachés à leur paiement), versé le (frais de retrait), confirmé le (frais SamirPay et frais repris).
5. **Remboursements envoyés mais pas encore confirmés : encore déduits du retirable.** Si SamirPay les a déjà retirés du solde, le retirable est un peu plus bas que la réalité, jamais plus haut.
6. **Mode d'essai.** Les sommes ne trient pas les lignes simulées, car il n'y en a jamais en production. Le retirable dit « Mode d’essai : chiffre sans valeur réelle. », et le cache du solde garde séparées les lectures réelles et simulées.
7. **Comparaison « frais réels / estimés » retirée de la page Finance.** Les frais réels sont dans le détail de « Gagné » ; l'alerte d'un taux de retrait trop bas reste dans les réglages. La route du rapprochement n'est plus lue par l'écran (noté dans l'après-lancement).
8. **`/api/admin/metrics` garde `netRevenue` et `totalVolume`**, avec la même mesure que « Gagné », comptée depuis le début. L'écran n'affiche que le gagné du mois. Aucun test existant n'a eu à changer pour cela.
9. **Avis « Retrait refusé par l'opérateur »** : il mène au dû aux partenaires, car le montant est rendu au solde et il n'y a rien à reprendre.
10. **Mode rapide de la CI.** Il n'existait pas. Une ligne `ci-rapide: <suites>` dans le message du commit poussé fait tourner typecheck, lint et ces seules suites, en 2 à 5 minutes. Sans cette ligne, la CI complète est inchangée. Seule la dernière vérification est complète.
11. **Fusion de `main` dans la branche** avant le run « après », comme tu l'as demandé : sans conflit, et rien de la 2a n'est retiré. Dans les fichiers partagés (liste du design, captures, catalogue des avis, workflow), les ajouts de la 3a sont placés loin de ceux de la 2a.

## Erreurs de ma part, trouvées et corrigées

- **Run 241, précondition fausse.** Je croyais que la promotion laissait `users.role` à CLIENT ; elle le recalcule. Le cas « cible SUPERADMIN dans `user_roles`, colonne `users.role` restée CLIENT » est désormais fabriqué dans une transaction annulée. Run 242 : rouge pour la bonne raison (« ok true » pour un SUPERADMIN).
- **Run 243, message d'assertion fautif.** `JSON.stringify(undefined).slice` levait une erreur alors que le champ n'était plus servi. Corrigé ; l'assertion est inchangée.
- **Run 246, attendu faux.** Le paiement en échec du scénario, créé à l'instant sans identifiant SamirPay, entre à bon droit dans « Versements à reprendre », comme dans la liste existante : 3 lignes et 55 100 F, pas 2. La règle de la fonction n'a pas bougé.
- **Trouvées en relecture, avant commit :**
  - la ligne « Gelé » du dû aux partenaires laissait croire qu'elle était comprise dans le retirable (elle en est exclue) : les lignes s'additionnent désormais exactement au total ;
  - le bouton « Réessayer » de la liste des paiements ne relançait rien ;
  - pendant le chargement de la session, la page affichait un instant le bandeau de permission manquante, même à un SUPERADMIN ;
  - l'accueil montrait un instant le squelette du bloc à un admin sans droit sur l'argent.

## Essais pour un non-développeur

Avec le compte SUPERADMIN, sur event-village-dev, une fois l'application déployée :
1. **Administration → Finance.** En haut : « Afficher : Ce mois-ci » et la phrase « Période affichée : du 1er au … ». Quatre cartes : « Gagné par Event Village », « Dû aux partenaires », « Retirable par Event Village » (avec « Solde SamirPay lu à … ») et « Créances ».
2. **Changer la période** pour « Mois dernier », puis pour « Dates choisies » (du … au … → « Afficher »). « Gagné » change ; « Dû aux partenaires » et « Créances » ne changent pas, car ce sont des chiffres à l'instant.
3. **Cliquer « Voir le détail » sous « Gagné ».** Les lignes, avec leurs signes, s'additionnent au chiffre du haut.
4. **Dans la liste des paiements, choisir le filtre « Remboursé ».** Seule la liste change ; les chiffres du haut restent les mêmes.
5. **Bouton « Réglages de la plateforme ».** Mettre « Montant fixe de la réserve de prudence » à 100 000, puis « Réserve de prudence » sur « Montant fixe », chacun avec un motif. Revenir sur Finance : dans « Calcul de ce qui est retirable », la réserve vaut 100 000 F CFA, avec la phrase « Montant fixe choisi par le Superadmin ». Remettre ensuite « Automatique ».
6. **Accueil de l'administration.** En haut, « Argent qui attend » : un clic sur « Voir les créances » ouvre la page Finance sur la liste des créances.
7. **Avec un compte ADMIN qui a seulement « Consulter les paiements ».** Tous les chiffres s'affichent, sauf « Retirable par Event Village » (réservé au Superadmin).
8. **Avec un compte ADMIN sans aucune permission sur l'argent.** L'accueil n'a pas de bloc « Argent qui attend », et la page Finance affiche « Votre compte n’a pas la permission « Consulter les paiements ». » au lieu des chiffres.

## À faire de ton côté

1. **Décider la fusion.** `main` (`fb3dcbcd6`, finition 2a) est déjà fusionné dans la branche : `main` peut avancer sur `finition-3a/argent` en avance rapide.
2. **Appliquer les quatre migrations `20261117…` sur event-village-dev**, après les `20261116…` de la 2a, avec les contrôles ci-dessus avant et après.
3. **Déployer l'application juste après.** L'ancienne page lit encore `/api/admin/finance/reconciliation`, qui reste là : rien ne casse entre les deux.
4. **Demander à SamirPay le délai de règlement** d'un encaissement, puis régler la réserve de prudence (page Finance → « Réglages de la plateforme »). Par défaut, elle garde les encaissements des 3 derniers jours.
5. **Deux tests fragiles à confier** à leurs propriétaires (notés dans `docs/apres-lancement.md`) : la cadence vers le service de cartes (finition 2a) et le vidage de la file dans `notif-envoyeur`.
6. **Dossier `event-village-finition3a`** (environ 570 Mo) : à retirer avec `git worktree remove` une fois la branche fusionnée. Il reste 9,5 Go libres sur C:.
