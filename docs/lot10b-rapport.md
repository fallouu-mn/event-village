# Lot 10b — Salles : écrans et parcours complet

Branche `lot10b/salles-ecrans`, partie de `main` à `fce22b609` (lot 11a fusionné). **Non fusionnée.** Le service reste
fermé par son interrupteur (`features.halls_enabled`) ; les suites l'ouvrent le temps de leur passage. Migrations
`20261126000001` à `…03`, sans BEGIN ni COMMIT, rejouables, **non appliquées** sur event-village-dev.

## À lire en premier

| # | Constat | Correctif |
|---|---|---|
| D1 | **Défaut trouvé.** La validation des salles et des établissements lisait le droit par `has_admin_permission`, ancienne fonction fondée sur `users.role` : un ADMIN de `user_roles` avec le droit était refusé, un ancien ADMIN gardé dans `users.role` aurait pu passer. | Nouveau droit lu par `admin_can` (rôles de `user_roles`), comme le reste de l'administration. |
| D2 | Les anciennes pages des salles affichaient des données inventées (équipements, surface, « Dakar & Environs », photo d'illustration) et `GET /api/partner/halls` rendait toutes les colonnes des réservations. | Pages réécrites ; lectures à colonnes nommées ; coordonnées du client données à la salle seulement après paiement. |
| D3 | Les photos d'une salle acceptaient n'importe quelle adresse. | Seulement les photos déposées par la route de dépôt (réencodées) dans le dossier de la partenaire, ou déjà sur la salle ; 12 au plus. |

## Ce que le lot livre

1. **Droit unique** `halls.validate` « Valider les salles et les établissements », dans le profil « Validation », pour
   les salles ET les établissements de tables (routes et fonctions) ; `partners.validate` ne garde que les comptes
   partenaires. Aucun administrateur ne le reçoit d'office : **le Superadmin doit le cocher**.
2. **Client** : recherche (lieu, date et durée, invités, prix maximum, disponibilité, tri) ; fiche (galerie,
   capacité, équipements, carte, calendrier des disponibilités, prix au jour et à l'heure, acompte et solde, règle
   d'annulation) ; devis calculé en base affiché avant de payer ; réservation, puis acompte ou totalité ;
   « Mes réservations » (états en mots, échéance du solde, payer le solde, annuler avec le montant rendu affiché avant de
   confirmer, remboursements en cours ou versés).
3. **Propriétaire** : mes salles, création et modification (photos réencodées, carte, prix, acompte, règle, capacité,
   équipements), renvoi en validation, retirer de la vente, calendrier du mois, détail, annulation avec motif (client
   remboursé en entier), recettes (disponible, à venir).
4. **Administration** : file de validation par statut, fiche de décision ; valider, refuser ou suspendre avec motif,
   réactiver ; avis aux administrateurs quand une salle validée change de nom, d'adresse (ou de position), de prix ou de
   photos (elle reste validée).
5. **Avis sur les 4 canaux** (cloche, push, email, SMS d'un segment GSM-7), règles de nuit, plafonds et préférences
   gardés :

| Étape | Type | Destinataire |
|---|---|---|
| Salle soumise | `ADMIN_HALL_SUBMITTED` + SMS groupé `ADMIN_REVIEW_SMS` (« N salle(s) ») | administrateurs avec `halls.validate` |
| Salle validée, refusée, suspendue | `HALL_VALIDATION_DECIDED` (SMS ajouté) | salle |
| Salle validée modifiée | `ADMIN_HALL_CHANGED` (cloche, push, email) | administrateurs |
| Réservation demandée | `HALL_RESERVATION_PENDING` (nouveau) | client |
| Confirmée / acompte reçu | `HALL_RESERVATION_CONFIRMED` / `HALL_RESERVATION_REQUESTED` (SMS ajouté) | client / salle |
| Rappels du solde J-10 et J-8 | `HALL_BALANCE_REMINDER` (deux clés) | client |
| Solde payé | `HALL_BALANCE_PAID` (SMS ajouté) | client et salle |
| Délai dépassé, annulation | `HALL_PAYMENT_DEADLINE_PASSED`, `HALL_RESERVATION_CANCELLED`, `_PRO` (SMS ajouté) | client, salle |
| Remboursement lancé | annonce dans l'avis d'annulation ou `HALL_PAYMENT_REFUNDED` | client |
| Remboursement versé | `HALL_REFUND_PAID` (nouveau, au lieu de l'avis des billets) | client |
| Rappel la veille | `HALL_EVE_REMINDER` (nouveau) | client et salle |
| Recettes disponibles | `HALL_EARNINGS_AVAILABLE` (nouveau) | salle |

Les rappels, la veille et les recettes partent de jour (en dehors de `notif.sms_quiet_start`/`_end`) par la tâche
`/api/cron/moratoriums`.

## Choix à connaître

- **Création = envoi en validation** (pas de brouillon) : une suite de la contre-vérification du lot 10a exige
  « en attente » à la création. Une salle **refusée puis modifiée reste refusée** jusqu'au bouton « Renvoyer en
  validation » (nom, prix par jour, adresse et ville, une photo, position exigés).
- Au plus **3 réservations en attente de paiement par client**, désormais réglage `halls.max_pending_per_client` (1 à 10).
- La recherche publique sert d'abord les salles les plus récentes (tri par prix au choix), 48 par page au plus.

## Migrations

| Fichier | Contenu |
|---|---|
| `…01_l10b_droit_validation` | `hall_validation_decide`, `venue_validation_decide` (droit `halls.validate`, `admin_can`) ; `notif_admin_review_sms` (salles) ; `ADMIN_VENUE_SUBMITTED` → `halls.validate` |
| `…02_l10b_salles` | réglage `halls.max_pending_per_client` (recopies de `finance_setting_set`, `fin_setting_valid`) ; `hall_client_pending_refusal` ; `halls_validation_guard` ; `hall_submit`, `hall_search`, `hall_calendar`, `hall_cancel_preview`, `hall_partner_earnings` |
| `…03_l10b_avis` | 6 types nouveaux, SMS ajouté à 4 types ; `trg_halls_notify_admins` ; recopies de `hall_reserve`, `hall_reservations_tick`, `notif_cashouts_notify` (depuis la version de la finition 4) |
| `…04_l10b_cv_correctifs` | contre-vérification T1 à T7, T4 bis et T5 bis : `partner_listed`, règles de lecture des salles, établissements, zones, tables et réservations ; recopies de `hall_reservation_cancel`, `hall_quote`, `hall_booking_refusal`, `notif_admin_review_sms`, `halls_notify_admins`, `hall_reservations_tick` |
| `…05_l10b_cv_droits_avis` | `ADMIN_PERMISSIONS_CHANGED`, `ADMIN_PERMISSIONS_ALERT` ; recopie de `admin_permissions_set` (avis en file dans la même transaction) |
| `…06_l10b_cv_envoi` | `halls.submitted_at` (date exacte d'envoi en validation) ; recopies de `halls_validation_guard` et `hall_submit` |
| `…07_l10b_cv_nuit` | T8 : trois types des salles en `night_policy` DEFER ; recopie de `hall_reservations_tick` sans garde de jour |

Chaque recopie part de la dernière définition (fichier et lignes cités) ; `migration-lot10b-rejouable` vérifie qu'aucune
ligne n'est perdue. Toutes les fonctions nouvelles sont réservées au rôle de service (`l10b-fonctions`).

## Tests existants modifiés (signalés)

| Test | Modification | Pourquoi |
|---|---|---|
| `notif-outbox`, `notif-modeles`, `notif-migration` | types, canaux, liens et SMS exacts des salles ; `ADMIN_VENUE_SUBMITTED` avec `halls.validate` | points 1 et 5 |
| `f3b-ecrans` | « Salles à valider » au menu (droit `halls.validate`, Superadmin) | point 4 |
| `l10a-textes` | SMS à chaque étape (au lieu de 5 types) | décision du client |
| `l10a-salles` | SMS du solde payé attendu (au lieu d'absent) | décision du client |
| `l10a-annulation` | rappel à J-10 de la date (au lieu de 3 jours avant l'échéance), nuit neutralisée le temps du test | décision du client |
| `tests/helpers/design-files.ts` | 48 écrans des salles ajoutés | système de design |

| `l11a-cv-correctifs` | 23 réglages des salles et des tables (au lieu de 22) | réglage `halls.max_pending_per_client` |
| `f2acv-ecritures-fiche` | renvoi en validation ajouté à l'inventaire, avec sa décision écrite | route nouvelle |
| `docs/recette-billetterie.md` | ligne citée de `notif-modeles` recalée ; page de la salle réécrite (plus de barre fixe) | contrôle `recette-matrice` |

Aucune assertion des suites d'audit (`tests/audit/*`) n'a changé : les recopies de `notif_admin_review_sms` et de
`notif_cashouts_notify` ont été refaites pour garder leurs lignes d'origine mot pour mot (`cv11a-5-recopies`, run 440).

## Runs

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 436 | `a1e340d09` | rapide, 24 suites | 19/24 : recettes (« per » hors du WITH, 500), menu non encore commité, 2 tests du lot 10a sur l'ancienne règle, `notif-admin` (ligne FAILED d'une suite voisine, `can_retry`) |
| 438 | `3fa66b0ab` | rapide, 16 suites | 15/16 : `l10a-salles` exigeait l'absence de SMS côté salle (décision du client) |
| 440 | `002d3d16b` | complet | 529/536 : filtres PostgREST (recherche admin), messages bruts (2), `l11a-cv-correctifs` (22 → 23 réglages), audit `cv11a-5-recopies` (lignes d'origine de deux recopies), inventaire des écritures partenaire, `recette-matrice` ; Lighthouse fiche 89 et Mes billets 87 (pages non touchées, JS +1 Ko, budgets tenus) |
| 443 | `89e6f9b68` | **complet** | **tests 536/536**, contrôle des lots OK, build, budgets JS, Lighthouse (92, 92, 90) ; e2e 630/631 : seule la capture `admin-notifications` (gabarit du champ de date « mm/dd/yyyy », instabilité déjà vue sur main au run 432, hors du lot) |
| 446 | `27f311fbb` | **complet** | **vert : tests 536/536**, contrôle des lots OK, build, budgets JS, e2e 631/631, Lighthouse (92, 92, 90) ; 55 min |

Journaux bruts : branche `ci-results`, `runs/436-44515221134/`, `runs/438-44517219772/`, `runs/440-44518060248/`, `runs/443-44527109456/`, `runs/446-44535947085/`.

## Mise en service (event-village-dev)

```sql
-- Avant : dernière migration de main appliquée ; rien du lot
select max(version) from supabase_migrations.schema_migrations;
select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('hall_submit', 'hall_search');
-- Après
select version from supabase_migrations.schema_migrations where version like '20261126%' order by 1;           -- 7 versions
select p.proname, has_function_privilege('anon', p.oid, 'execute'), has_function_privilege('authenticated', p.oid, 'execute')
  from pg_proc p where p.pronamespace = 'public'::regnamespace
   and p.proname in ('hall_submit','hall_search','hall_calendar','hall_cancel_preview','hall_partner_earnings') order by 1; -- false, false
select key, value from public.platform_settings where key = 'halls.max_pending_per_client';                      -- 3
select has_function_privilege('anon', 'public.partner_listed(uuid)', 'execute');                                 -- true (booléen seul)
select type, night_policy from public.notification_types
 where type in ('HALL_BALANCE_REMINDER', 'HALL_EVE_REMINDER', 'HALL_EARNINGS_AVAILABLE') order by 1;             -- DEFER × 3
select type, channels from public.notification_types where type like 'ADMIN_PERMISSIONS_%' order by 1;          -- 4 canaux
select type, channels, admin_permission from public.notification_types
 where type like 'HALL\_%' or type in ('ADMIN_HALL_SUBMITTED', 'ADMIN_HALL_CHANGED', 'ADMIN_VENUE_SUBMITTED') order by 1;
```

Puis `03-verification.sql` (9 aides des politiques, `partner_listed` comprise), et cocher « Valider les salles et les établissements » aux administrateurs concernés.

## Points ouverts

- Fusion en dernier (après design-1c et finition-4) : conflits attendus dans `lib/notifications/catalog.ts`,
  `components/layout/admin-nav.ts`, `tests/parcours/notif-*.test.ts` et la recopie de `finance_setting_set` /
  `fin_setting_valid` si une autre branche les redéfinit (la dernière doit garder toutes les clés).
- Captures e2e et contrôle responsive des pages des salles : faits aux correctifs (section suivante). Budgets JS : pages des salles non mesurées.
- Écrans des établissements de tables (validation comprise) : lot 11b ; le droit est déjà prêt.
- Vraies valeurs (acompte par défaut, durée de garde) et date exacte d'envoi en validation : faites aux correctifs.

## Correctifs de la contre-vérification

Contre-vérification : `docs/audit-lot10b.md` (branche `lot10b/rouges`, `e36ad3e24`), avancée dans cette branche. Ses
suites `tests/audit/cv10b-1` à `-3` sont les tests rouges du run 456 ; **assertions inchangées**, toutes vertes au run
482. `main` (design 1c, 1c bis, finition 4 : `40ffd1a74`) fusionné dans la branche (`5a5f00b84`). Migrations
`20261126000004` à `…07`, sans BEGIN ni COMMIT, rejouables ; chaque recopie part de la dernière définition (fichier et
lignes cités en tête de migration) et le test `migration-lot10b-rejouable` vérifie qu'aucune ligne n'est perdue.

| # | Trou (gravité) | Correctif | Commit |
|---|---|---|---|
| T1 | Fiche partenaire SUSPENDU : modifier, supprimer une salle, annuler une réservation payée (moyenne) | écritures `/api/partner/halls*` refusées à une fiche SUSPENDU (403 `PARTNER_SUSPENDED`, texte des salles) ; en base, `hall_reservation_cancel` exige la fiche VALIDE pour l'origine SALLE (Event Village annule pour elle) ; inventaire `f2acv` mis à jour | `e74538000` |
| T5 | Note du client non payée lue par la salle par la REST (moyenne) | la salle ne lit plus ses réservations par la REST (`hall_reservations_read` : le client, l'administration) ; ses écrans passent par les routes serveur | `e74538000` |
| T2 | Contacts de la partenaire avec `halls.validate` seul (faible) | téléphone et email seulement avec `partners.read` ; sinon « Réservé au droit Consulter les partenaires » | `e74538000` |
| T3 | Salle non validée réservable quand la validation est désactivée (faible) | `hall_quote` et `hall_booking_refusal` exigent VALIDEE quel que soit le réglage | `e74538000` |
| T4 | Salle d'une partenaire suspendue lisible par la REST (faible) | lecture publique seulement si la partenaire est VALIDE (`partner_listed`, un booléen lisible par anon) | `e74538000` |
| T6 | Salle validée modifiée : pas de SMS aux administrateurs (faible) | SMS groupé (élément `HALL_CHANGED`, reporté à la fin de la nuit) : « N salle(s) validée(s) modifiée(s) à vérifier » | `e74538000`, `dc78f0a75` |
| T7 | Rappels du solde écrits en dur à J-10 et J-8 (faible) | rappels 3 jours puis 1 jour avant l'échéance, quel que soit `halls.balance_due_days` (J-10 et J-8 avec l'échéance par défaut) | `e74538000` |
| T8 | Rappel du solde envoyé la nuit (faible) | après la fusion de la finition 4 : `HALL_BALANCE_REMINDER`, `HALL_EVE_REMINDER`, `HALL_EARNINGS_AVAILABLE` classés `night_policy` DEFER (son mécanisme) ; la garde de jour du lot 10b retirée de `hall_reservations_tick` (aucun second mécanisme) | `5654990a8` |

### Les mêmes trous sur les tables (T4 bis, T5 bis)

Vérifiés par `tests/security/l10b-cv-tables` (clé anon et jetons), **rouges au run 459** (`d607d7500`, tests seuls) :

```
[L10B-CV] T4 bis visiteur : {"venue":[{"id":"d49b57f7-…"}],"table":[{"id":"14f7b51e-…"}],"zone":[{"id":"ab58f735-…"}]}
not ok 1 - T4 bis. Établissement d’une partenaire suspendue lisible par la REST anonyme
[L10B-CV] T5 bis REST de l’établissement : [{"id":"d03e8887-…","client_id":"6aff7404-…","booking_state":"CONFIRMEE","special_requests":"Appelez-moi au 777112889"}]
not ok 2 - T5 bis. Réservations de tables lues par l’établissement par la REST
```

Corrigés comme T4 et T5 (`venues`, `restaurant_zones`, `restaurant_tables` : partenaire VALIDE ; `table_reservations` :
le client et l'administration), verts aux runs 460 et 482. T5 bis est plus faible que T5 : la route de l'établissement
donne déjà la demande du client ; la REST ajoutait l'identifiant du compte du client et des colonnes internes.

### R1 de la contre-vérification de la finition 4

La recopie de `notif_cashouts_notify` (migration `20261126000003`) partait de la version 11a et aurait effacé la
finition 4. Elle part désormais de `20261125000003_f4_ventes.sql:568-879` (auteur, canaux choisis, avis groupé
`PARTNER_REFUND_REQUESTS`, `not_paid` gardés) ; la branche du remboursement d'une salle (`HALL_REFUND_PAID`) s'ajoute à
côté, l'avis des billets est inchangé. **Preuve : `f4-messages` et `f4-recopies` verts sur la branche (run 482).**
Même défaut trouvé et corrigé pour `finance_setting_set` (migration `…02`) : elle part de
`20261124000001_d1cbis_restes.sql:91-143` (message du refus du design 1c bis, vérifié en base par `notif-reglages`).

### Demande du 19/11 : droits d'un administrateur

N'existait pas (le changement n'allait qu'au journal d'audit). Migration `…05` : `admin_permissions_set` met en file, dans
la même transaction, `ADMIN_PERMISSIONS_CHANGED` pour l'administrateur (4 canaux : « Vous pouvez maintenant valider les
salles et les établissements. » / « Vous ne pouvez plus … ») et `ADMIN_PERMISSIONS_ALERT` pour les autres
super-administrateurs actifs (4 canaux) ; rien si les droits ne changent pas ; l'auteur ne reçoit pas d'alerte. SMS d'un
segment au pire cas : un droit 83 caractères, plusieurs droits (décompte et lien) 132, alerte 158 (noms à 20). Suite
`tests/parcours/l10b-droits-avis` (route réelle, identité du super-administrateur confirmée).

### Points ouverts du rapport, expérience

- Vraies valeurs : acompte par défaut (« Acompte d'Event Village : 30 % ») et durée de garde (« La date est gardée
  15 minutes pour payer ») ; date exacte d'envoi en validation (`halls.submitted_at`, migration `…06`, file triée par elle).
- Formulaire de la salle : saisie gardée sur l'appareil (« Reprendre ma salle en cours ») ; salle refusée : motif
  visible, « Corriger et renvoyer » (enregistrer puis renvoyer en validation).
- Fiche : galerie plein écran qu'on fait glisser (chargée à la demande), calendrier des disponibilités coloré avec un
  second signal et sa légende, prix total recalculé en direct par le serveur (aucun calcul à l'écran).
- Contrôle responsive (design 1c) : 12 pages des salles contrôlées à 6 largeurs, clair et sombre ; captures e2e
  (13 écrans) ; interrupteur ouvert le temps de ces tests seulement (verrou entre workers, `e2e/support/halls-switch.ts`).
- Écrans des salles alignés sur le design 1c (arrondi de 12 px, file en cartes jusqu'à xl).

### Tests modifiés (signalés)

| Test | Modification | Pourquoi |
|---|---|---|
| `r30-salles-lecture`, `r31-tables-lecture` | la salle et l'établissement ne lisent plus leurs réservations par la REST | T5, T5 bis |
| `tests/audit/cv11a-4-droits` (précondition seulement) | « la propriétaire lit sa réservation » → « lit son établissement » ; assertion de sécurité inchangée | T5 bis (la précondition ne servait qu'à prouver la session) |
| `f2acv-ecritures-fiche` | écritures des salles retirées de la liste des écritures gardées | T1 |
| `notif-outbox`, `notif-modeles`, `notif-migration` | 2 types (droits), SMS groupé des salles modifiées, inventaire | demande du 19/11, T6 |
| `l10b-avis` (suite du lot) | clés J3 et J1 ; nuit sans garde de jour | T7, T8 |
| `e2e/support/responsive-pages.ts`, `screens.ts`, specs, seed de démonstration | pages et écrans des salles, interrupteur ouvert le temps du test | contrôle responsive, captures |
| `tests/schema/fonctions-privileges`, `supabase/hotfix/2026-10-31-lot1a/03-verification.sql` | `partner_listed` ajoutée à la liste blanche des aides des politiques (9 au lieu de 8) | T4 (une aide lisible par anon, comme les 8 autres) |
| `docs/recette-billetterie.md` | lignes citées de `fonctions-privileges` recalées (93, 131) | ajout ci-dessus |
| `notifications` (responsive et capture) | préchargement du lien d'une réservation de salle toléré (404 tant que le service est fermé) | voir ci-dessous |

### Constat produit

Quand le service des salles est fermé, une notification de réservation de salle mène à une page introuvable (404) :
à trancher à l'ouverture (masquer le lien, ou laisser « Mes réservations » ouvert service fermé comme l'annulation).

### Runs

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 459 | `d607d7500` | rapide, tests seuls | rouge voulu : T4 bis et T5 bis |
| 460 | `522e2be9f` | rapide, 21 suites | 18/21 : T8 (attendu avant la finition 4), mon test des droits sans identité confirmée, mes clés J10/J8 |
| 462 | `dae4ca5d8` | rapide, 11 suites | 10/11 : seul T8 (attendu) |
| 482 | `a956ba3f7` | rapide, 18 suites | **vert 18/18** : `f4-messages`, `f4-recopies`, `f4-textes`, `cv10b-1` à `-3` (T1-T8), `cv11a-5-recopies`, `l10b-cv-tables`, avis |
| 483 | `de7d1fd27` | complet | rouge : `partner_listed` hors liste blanche ; brouillon de la salle écrit hors de `local-draft` (non effacé à la déconnexion, `cvf2b-6`) ; `/halls` en erreur (fonction d’un module client appelée par la page serveur) ; jours du calendrier de 34 et 40 px à 320 et 360 px (responsive) ; `notif-pros` (nuit, voir plus bas) |
| 487 | `731f47502` | complet | tests 554/557, build, budgets JS, **responsive 0 défaut** (74 pages, dont les 12 des salles), Lighthouse (92, 92, 90) ; e2e 685/687 : nom lu de la bande des jours (axe) ; `hotfix-scripts` (compte des aides), `recette-matrice` (lignes citées), `notif-pros` (nuit) |
| 490 | `50347ac53` | complet | tests 556/557 (seul `notif-pros`, nuit) ; e2e 685/687 et responsive 4 défauts : la fiche d’une salle élargie à 698 px sur téléphone (texte masqué de la bande des jours sorti de la zone qui défile) ; Lighthouse Mes billets 89 (page non touchée, 90 au run 487) |

### `notif-pros` la nuit (hors du lot)

Runs 483, 487 et 490, lancés entre 02:24 et 04:45 (heure de Dakar) : `notif-pros` envoie des avis non urgents
(`EVENT_REJECTED`, `PARTNER_VALIDATED`…) « maintenant » ; classés DEFER par la finition 4, ils restent en attente pendant
la plage de nuit (01:00 → 07:00). Journal brut (run 487) :

```
not ok 1 - refus par l’admin avec motif puis validation : EVENT_REJECTED et EVENT_VALIDATED, quatre canaux, SMS exacts
EVENT_REJECTED:…:SMS : SMS SENT (statut PENDING, motif null )
```

La finition 4 l’a déjà corrigé sur sa branche (`eebe40e02`, `nowOutsideNight`, run 480 de main), mais ce commit n’est pas
dans main (`40ffd1a74`). Rien n’est changé ici : le correctif arrivera avec main ; le run final est lancé après 07:00.
