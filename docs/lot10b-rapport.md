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
| `…03_l10b_avis` | 6 types nouveaux, SMS ajouté à 4 types ; `trg_halls_notify_admins` ; recopies de `hall_reserve`, `hall_reservations_tick`, `notif_cashouts_notify` |

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
-- Avant : dernière migration 20261123000113 ; rien du lot
select max(version) from supabase_migrations.schema_migrations;
select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('hall_submit', 'hall_search');
-- Après
select version from supabase_migrations.schema_migrations where version like '20261126%' order by 1;           -- 3 versions
select p.proname, has_function_privilege('anon', p.oid, 'execute'), has_function_privilege('authenticated', p.oid, 'execute')
  from pg_proc p where p.pronamespace = 'public'::regnamespace
   and p.proname in ('hall_submit','hall_search','hall_calendar','hall_cancel_preview','hall_partner_earnings') order by 1; -- false, false
select key, value from public.platform_settings where key = 'halls.max_pending_per_client';                      -- 3
select type, channels, admin_permission from public.notification_types
 where type like 'HALL\_%' or type in ('ADMIN_HALL_SUBMITTED', 'ADMIN_HALL_CHANGED', 'ADMIN_VENUE_SUBMITTED') order by 1;
```

Puis `03-verification.sql`, et cocher « Valider les salles et les établissements » aux administrateurs concernés.

## Points ouverts

- Fusion en dernier (après design-1c et finition-4) : conflits attendus dans `lib/notifications/catalog.ts`,
  `components/layout/admin-nav.ts`, `tests/parcours/notif-*.test.ts` et la recopie de `finance_setting_set` /
  `fin_setting_valid` si une autre branche les redéfinit (la dernière doit garder toutes les clés).
- Captures e2e et budgets JS des pages des salles : non ajoutés (service fermé, pages en 404 en recette).
- Écrans des établissements de tables (validation comprise) : lot 11b ; le droit est déjà prêt.
- La valeur par défaut de l'acompte (`halls.deposit_default_percent`) et la durée de garde (`halls.hold_minutes`) ne
  sont pas montrées dans le formulaire de la salle ni dans le panneau de paiement (texte « valeur par défaut »,
  « quelques minutes »).
- Date d'envoi en validation exacte : la file affiche la date de dernière modification.
