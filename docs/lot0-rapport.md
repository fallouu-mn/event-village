# LOT 0 — RAPPORT

**Objet :** fondations de vérification (aucun constat métier corrigé).
**Branche :** `fix/evenementiel` (créée depuis `main` @ `5195ddb`). Aucun push sur `main`.
**Date :** 31 octobre 2026.

**Résultat :** `npm run verify` (typecheck → lint → tests → build) passe en CI sur une instance Supabase locale créée depuis zéro, seedée par le seed de test : https://github.com/fallouu-mn/event-village/actions/runs/41200635321. Les 31 suites héritées ont été exécutées une fois sur cette base : 9 passent et 22 échouent. 21 ne sont pas portables (identifiants de la base distante codés en dur) et 25 encodent au moins un comportement que l'audit a classé fautif. Les suites en échec, plus 9 autres fichiers de `tests/` absents de l'ancienne chaîne `npm test`, sont en quarantaine dans `tests/legacy/` sans modification de logique. `npm test` exécute désormais 13 suites, toutes vertes, dont la nouvelle suite de preuve des fondations.

Journaux bruts joints : `docs/lot0-logs/`. Inventaire détaillé : `docs/lot0-inventaire-suites.md`.

---

## 1. Commits

| Hash | Message | Tâche |
|---|---|---|
| 61108a2 | docs(audit): rapport d'audit du parcours événementiel vs CDC V3, annexe des 151 constats et CDC de référence | 0.1 |
| 0fdafb8 | chore(docs): archiver les synthèses IA contredites par l'audit du 30/10/2026 | 0.1 |
| a4b3c21 | fix(db): versions de migration uniques pour supabase db reset | 0.3 |
| 7860a05 | build(env): validation Zod de l'environnement serveur et correctifs ESLint | 0.8 |
| 610041a | refactor(integrations): adaptateurs injectables SMS, email et SamirPay + faux adaptateurs de test | 0.5 |
| b3baaff | test(garde-fou): refus de démarrer hors Supabase locale, environnement .env.test | 0.2 / 0.3 |
| bd5bb88 | test(seed): seed de test idempotent et fixtures sans UUID codés en dur | 0.4 |
| 7800fd2 | build(tests): lanceur unique node:test, scripts test / test:security / seed:test / verify | 0.6 |
| 607bd53 | ci: workflow GitHub Actions verify (Supabase local, db reset, seed, verify) | 0.9 |
| 88ff42d | docs(tests): mode d'emploi des fondations de test (instance locale, fixtures, faux adaptateurs) | 0.6 |
| 9bae9a1 | ci: publication des journaux bruts sur la branche ci-results, annotations d'erreur, diagnostics du seed | 0.9 |
| d54a8ab | fix(db): search_path explicite des fonctions déclenchées depuis auth.users | 0.3 / 0.4 |
| 90fdcc2 | test(legacy): quarantaine des 31 suites héritées non portables, script test:legacy | 0.7 |
| c6956a7 | test(garde-fou): verrou réseau sur fetch + suite de preuve des fondations du lot 0 | 0.2 / 0.5 |
| 4722bd7 | build(font): Plus Jakarta Sans auto-hébergée via next/font/local | 0.8 |
| 70da199 | build(verify): environnement de build sans EV_INTEGRATIONS et .env.local neutralisé | 0.6 / 0.8 |

Ce rapport est ajouté par le commit qui suit 70da199.

**Défaut d'historique à connaître.** Le commit a4b3c21 contient, en plus des migrations, le renommage `lib/samirpay/client.ts → lib/samirpay/http-client.ts` : il avait été indexé par `git mv` avant le commit. Le fichier `lib/samirpay/client.ts` n'est recréé qu'en 610041a. Les commits a4b3c21 et 7860a05 ne compilent donc pas isolément ; la pointe de branche compile. Corriger l'historique demande un push forcé sur `fix/evenementiel` : à décider.

### Tests modifiés (règle « ne jamais modifier un test pour le faire passer sans le signaler »)

Aucune assertion ni aucune logique de test n'a été modifiée. Les seules modifications sont :

- **44 fichiers** : le chargeur inline de `.env.local` est remplacé par `import './helpers/env'` (35 fichiers), ou cet import est ajouté en tête (9 fichiers sans chargeur). Raison : tâche 0.2, aucun test ne doit pouvoir lire `.env.local`.
- **`ticket-transfers-phase1-schema`** : le chemin de migration vérifié par le test 12 passe de `20260908_ticket_transfers_p2p.sql` à `20260908000001_ticket_transfers_p2p.sql`. Raison : renommage des migrations (section 2).
- **31 fichiers déplacés** dans `tests/legacy/` avec leurs imports relatifs ajustés (`../` → `../../`). Raison : tâche 0.7, ils échouent tous sur la base locale ; ils restent exécutables par `npm run test:legacy`.

---

## 2. `supabase db reset` et corrections de migrations

### Sortie brute (CI, run 6, base vierge)

```text
Resetting local database...
WARN: config section [inbucket] is deprecated and will be removed in v3, use [local_smtp] instead.
Recreating database...
Initialising schema...
Seeding globals from roles.sql...
Applying migration 0001_initial_schema.sql...
Applying migration 0002_functions.sql...
Applying migration 0003_rls.sql...
Applying migration 0004_indexes.sql...
Applying migration 0005_storage_and_auth.sql...
Applying migration 0006_superadmin_bootstrap.sql...
Applying migration 0007_superadmin_complete.sql...
Applying migration 0008_partner_auth_production.sql...
Applying migration 0009_hall_reservations_exclusion.sql...
Applying migration 0010_table_reservations_exclusion.sql...
Applying migration 0011_referral_codes.sql...
Applying migration 0012_platform_financial_settings.sql...
Applying migration 20260902000001_create_rate_limits.sql...
Applying migration 20260902000002_event_category.sql...
Applying migration 20260902000003_event_services_promotions.sql...
Applying migration 20260903000001_atomic_withdrawal_rpc.sql...
Applying migration 20260903000002_ticket_categories_enrich.sql...
Applying migration 20260904000001_atomic_ticket_checkin.sql...
Applying migration 20260904000002_event_controllers.sql...
Applying migration 20260904000003_fix_handle_new_user.sql...
Applying migration 20260906000001_atomic_partner_remove_controller.sql...
Applying migration 20260906000002_controller_shifts.sql...
Applying migration 20260906000003_ticket_totp_secret.sql...
Applying migration 20260906000004_user_roles_multi_role.sql...
Applying migration 20260907000001_ticket_categories_hold_cart.sql...
Applying migration 20260907000002_ticket_categories_realtime_replica.sql...
Applying migration 20260907000003_tickets_realtime_replica.sql...
Applying migration 20260907000004_user_status_supprime.sql...
Applying migration 20260908000001_ticket_transfers_p2p.sql...
Applying migration 20260910000001_event_cancellation_and_refunds.sql...
Applying migration 20261031000001_functions_search_path.sql...
Seeding data from supabase/seed.sql...
Restarting containers...
Finished supabase db reset on branch fix/evenementiel.
```

Les 31 migrations s'appliquent dans l'ordre, puis `supabase/seed.sql`. Sortie de `supabase start` du même run : `docs/lot0-logs/ci-run6-supabase-start.log`.

### Corrections apportées

Aucune correction ne change le sens métier d'une migration.

1. **Versions de migration en double (a4b3c21).** Supabase CLI identifie une migration par le préfixe numérique de son nom. Dix-huit fichiers partageaient cinq versions (`20260902`, `20260903`, `20260904`, `20260906`, `20260907`), ce qui collisionne sur la clé primaire de `supabase_migrations.schema_migrations`. Renommage en `<date>00000N_<nom>`, ordre d'application conservé, contenu SQL inchangé :

   | Ancien nom | Nouveau nom |
   |---|---|
   | 20260902_create_rate_limits.sql | 20260902000001_create_rate_limits.sql |
   | 20260902_event_category.sql | 20260902000002_event_category.sql |
   | 20260902_event_services_promotions.sql | 20260902000003_event_services_promotions.sql |
   | 20260903_atomic_withdrawal_rpc.sql | 20260903000001_atomic_withdrawal_rpc.sql |
   | 20260903_ticket_categories_enrich.sql | 20260903000002_ticket_categories_enrich.sql |
   | 20260904_atomic_ticket_checkin.sql | 20260904000001_atomic_ticket_checkin.sql |
   | 20260904_event_controllers.sql | 20260904000002_event_controllers.sql |
   | 20260904_fix_handle_new_user.sql | 20260904000003_fix_handle_new_user.sql |
   | 20260906_atomic_partner_remove_controller.sql | 20260906000001_atomic_partner_remove_controller.sql |
   | 20260906_controller_shifts.sql | 20260906000002_controller_shifts.sql |
   | 20260906_ticket_totp_secret.sql | 20260906000003_ticket_totp_secret.sql |
   | 20260906_user_roles_multi_role.sql | 20260906000004_user_roles_multi_role.sql |
   | 20260907_ticket_categories_hold_cart.sql | 20260907000001_ticket_categories_hold_cart.sql |
   | 20260907_ticket_categories_realtime_replica.sql | 20260907000002_ticket_categories_realtime_replica.sql |
   | 20260907_tickets_realtime_replica.sql | 20260907000003_tickets_realtime_replica.sql |
   | 20260907_user_status_supprime.sql | 20260907000004_user_status_supprime.sql |
   | 20260908_ticket_transfers_p2p.sql | 20260908000001_ticket_transfers_p2p.sql |
   | 20260910_event_cancellation_and_refunds.sql | 20260910000001_event_cancellation_and_refunds.sql |

   Correction préventive : l'échec avec les noms d'origine n'a pas été reproduit, car la première exécution de `supabase db reset` (CI run 1) a eu lieu après le renommage. Docker est absent du poste de développement.

2. **`search_path` des fonctions déclenchées depuis `auth.users` (d54a8ab, nouvelle migration `20261031000001_functions_search_path.sql`).** Sur base vierge, toute création d'utilisateur échouait. Sortie brute du seed, CI run 2 :

   ```text
   [seed-test] Instance : http://127.0.0.1:54321
   [seed-test] platform_settings…
   [seed-test] utilisateur CLIENT…
   [seed-test] auth.createUser(CLIENT) : Database error creating new user
   ```

   GoTrue exécute ses requêtes avec le rôle `supabase_auth_admin` (search_path `auth`). Le trigger `handle_new_user` et sa chaîne (`set_referral_code_on_insert`, `generate_referral_code`, `sync_user_roles_to_jwt`, `audit_log_changes`) utilisent des noms non qualifiés (`user_roles`, type `user_role`, `audit_logs`). La migration fixe le `search_path` de ces sept fonctions par `ALTER FUNCTION … SET search_path`, sans toucher à leurs corps. Le seed passe à partir du run 3. Cette correction ne bloquait pas l'application des migrations, mais bloquait le seed (tâche 0.4).

### `.env.test` et `.env.test.example`

- `.env.test.example` (versionné) pointe sur `http://127.0.0.1:54321` avec les clés de démonstration publiques de Supabase local, des URLs SamirPay et MTarget sur un port local fermé, une clé Resend factice. Aucun secret.
- `.env.test` (copie locale) est ignoré par git (`.gitignore`). En CI, il est régénéré à partir de `supabase status -o env`.

---

## 3. Preuve du garde-fou (sortie brute)

Le garde-fou `tests/helpers/env.ts` est chargé par tous les tests : par le lanceur (`node --import ./tests/helpers/env.ts`) et par l'import en tête de chaque fichier. Il charge uniquement `.env.test`, refuse toute URL Supabase ou service externe non locale, gèle les variables Supabase, refuse toute requête `fetch` vers un hôte non local et installe les faux adaptateurs. Le nom d'hôte du projet distant est masqué ci-dessous ; le reste est verbatim.

```text
$ EV_ENV_FILE=.env.local node --import tsx --import ./tests/helpers/env.ts tests/payment.test.ts

[tests/helpers/env] REFUS DE DÉMARRER — NEXT_PUBLIC_SUPABASE_URL ne pointe pas sur une instance Supabase LOCALE.
  Valeur chargée (hôte) : <ref-projet>.supabase.co (source : .env.local ou variables du shell)
  Les tests ne doivent JAMAIS toucher le projet distant. Attendu : http://127.0.0.1:54321 (supabase start).

EXIT=1
```

```text
$ NEXT_PUBLIC_SUPABASE_URL=https://exemple-distant.supabase.co node --import tsx --import ./tests/helpers/env.ts tests/payment.test.ts
[tests/helpers/env] REFUS DE DÉMARRER — NEXT_PUBLIC_SUPABASE_URL ne pointe pas sur une instance Supabase LOCALE.
  Valeur chargée (hôte) : exemple-distant.supabase.co (source : .env.test ou variables du shell)
  Les tests ne doivent JAMAIS toucher le projet distant. Attendu : http://127.0.0.1:54321 (supabase start).

EXIT=1
```

```text
$ node --import tsx --import ./tests/helpers/env.ts -e "process.env.NEXT_PUBLIC_SUPABASE_URL='https://x.supabase.co'"
            throw new Error(
                `[tests/helpers/env] Tentative de modification de ${key} pendant les tests (garde-fou anti-base réelle). ` + ...
EXIT=1
```

La suite `tests/fondations-lot0.test.ts` rejoue ces garanties à chaque `npm test` : URL locale, variables gelées, requêtes vers `api.resend.com` et `api-public-2.mtarget.fr` bloquées, façades SMS, email et SamirPay branchées sur les faux adaptateurs, scénarios SamirPay (init réussi, refus dans le corps, exception, statuts success / failed / pending, webhooks signés ou non), échec explicite de `lib/env.ts`, fixtures résolues depuis le seed. Elle passe en CI (section 5).

---

## 4. Inventaire des 31 suites existantes

Méthode : exécution unique des 43 fichiers de `tests/` sur la base locale seedée (CI run 3, `41161426009`, journaux par suite sur la branche `ci-results`), croisée avec une lecture statique de chaque fichier. La logique métier n'a pas été corrigée.

Lecture du tableau : la colonne « Exécution » donne PASSE ou ÉCHOUE ; « Portabilité » donne PORTABLE ou NON PORTABLE et l'adaptation ; la dernière colonne liste les comportements fautifs encodés, avec la référence du constat de l'annexe d'audit et le lot où la suite sera réécrite. Le détail (lignes, description de chaque assertion fautive, assertions faibles) est dans `docs/lot0-inventaire-suites.md`.

| # | Suite | Exécution sur base locale (CI run 3) | Cause d'échec | Portabilité | Comportements fautifs encodés (constat → lot de réécriture) |
|---|---|---|---|---|---|
| 1 | payment | PASSE (6 tests) | — | PORTABLE | 2 : payment-security-1, ticketing-finance-1, client-ux-1, ticketing-finance-14 → lot 2 |
| 2 | e2e-scenarios | PASSE (11 tests) | — | PORTABLE | 5 : payment-security-1, payment-security-13, payment-security-10, ticketing-finance-1, ticketing-finance-2 → lot 2 ; scan-security-7, scan-security-1, scan-security-14 → lot 4 ; controller-ux-17 → lot 5 |
| 3 | auth-rbac | PASSE (21 tests) | — | PORTABLE | 2 : client-ux-19, data-model-1 → lot 3 ; partner-ux-1, scan-security-2 → lot 4 |
| 4 | mtarget-sms | ÉCHOUE (8 ok / 2 ko / 0 annulés) | Tests 8-9 : 401 au lieu de 400/200 — SUPABASE_AUTH_HOOK_SECRET défini (comme en production), la route exige une signature, les requêtes du test n'en ont pas. | PORTABLE | 1 : payment-security-1, scan-security-12 → lot 2 |
| 5 | superadmin-complete | PASSE (10 tests) | — | PORTABLE | 2 : ticketing-finance-1, client-ux-1 → lot 2 ; data-model-10 → lot 3 |
| 6 | partner-auth-complete | PASSE (24 tests) | — | PORTABLE | 1 : data-model-8, scan-security-8 → lot 3 |
| 7 | roles-isolation | PASSE (7 tests) | — | PORTABLE | 4 : scan-security-1, scan-security-6, scan-security-14, scan-security-2, controller-ux-18 → lot 4 ; ticketing-finance-1, client-ux-1, ticketing-finance-2 → lot 2 ; data-model-10 → lot 3 |
| 8 | notifications-and-documents | PASSE (5 tests) | — | PORTABLE | — |
| 9 | camera-qr-scanner | ÉCHOUE (0 ok / 0 ko / 4 annulés) | Hook before() : Échec création event: insert or update on table "events" violates foreign key constraint "events_partner_id_fkey" | NON PORTABLE — 3 UUID distants → loadFixtures() | 2 : scan-security-1, scan-security-2, partner-ux-1, scan-security-11 → lot 4 |
| 10 | controller-14-points | ÉCHOUE (0 ok / 0 ko / 14 annulés) | Hook before() : Cannot read properties of null (reading 'id') | NON PORTABLE — 6 UUID distants → loadFixtures() ; supprimer la réécriture de comptes | 3 : scan-security-1, client-ux-9, scan-security-20, data-model-3 → lot 4 |
| 11 | controller-realtime-sync | ÉCHOUE (0 ok / 0 ko / 5 annulés) | Hook before() : Cannot read properties of null (reading 'id') | NON PORTABLE — 3 UUID distants → loadFixtures() ; supprimer la réécriture de comptes | 1 : scan-security-1, client-ux-9, controller-ux-11 → lot 4 |
| 12 | controller-multi-role | ÉCHOUE (0 ok / 0 ko / 6 annulés) | Hook before() : Token Partenaire A généré avec succès | NON PORTABLE — 4 UUID distants → loadFixtures() ; supprimer la réécriture de comptes | 1 : data-model-12 → lot 3 |
| 13 | security-fixes | ÉCHOUE (0 ok / 0 ko / 10 annulés) | Hook before() : insert or update on table "events" violates foreign key constraint "events_partner_id_fkey" | NON PORTABLE — 5 UUID distants → loadFixtures() ; supprimer la réécriture de comptes | 1 : scan-security-1, scan-security-7 → lot 4 |
| 14 | dynamic-qr-totp | ÉCHOUE (0 ok / 0 ko / 7 annulés) | Hook before() : Token Partenaire obtenu | NON PORTABLE — 4 UUID distants → loadFixtures() ; supprimer la réécriture de comptes | 3 : scan-security-1, client-ux-9, scan-security-11, scan-security-2, partner-ux-1, scan-security-14 → lot 4 |
| 15 | controller-shifts-z | ÉCHOUE (0 ok / 0 ko / 9 annulés) | Hook before() : Token Partenaire obtenu | NON PORTABLE — 4 UUID distants → loadFixtures() ; supprimer la réécriture de comptes | 2 : scan-security-1, client-ux-9, scan-security-13 → lot 4 |
| 16 | scanner-combat-ui | PASSE (6 tests) | — | PORTABLE | — |
| 17 | scanner-wolof-audio | PASSE (16 tests) | — | PORTABLE | 1 : controller-ux-4 → lot 5 |
| 18 | scanner-security-hardening | ÉCHOUE (0 ok / 0 ko / 5 annulés) | Hook before() : Token Partenaire obtenu | NON PORTABLE — 4 UUID distants → loadFixtures() ; supprimer la réécriture de comptes | 2 : scan-security-12 → lot 4 ; controller-ux-6 → lot 5 |
| 19 | client-ticket-lifecycle | ÉCHOUE (0 ok / 0 ko / 20 annulés) | Hook before() : buyerToken obtenu | NON PORTABLE — 4 UUID distants → loadFixtures() ; supprimer la réécriture de comptes | 6 : scan-security-1, scan-security-5, client-ux-8 → lot 4 ; payment-security-1, payment-security-4, ticketing-finance-1, client-ux-1 → lot 2 |
| 20 | ticket-stock-lifecycle | ÉCHOUE (0 ok / 0 ko / 22 annulés) | Hook before() : partnerToken obtenu | NON PORTABLE — 5 UUID distants → loadFixtures() ; supprimer la réécriture de comptes | 4 : scan-security-1, client-ux-9, controller-ux-11, scan-security-14 → lot 4 ; ticketing-finance-1, ticketing-finance-2, client-ux-1 → lot 2 |
| 21 | ticketing-e2e-final | ÉCHOUE (0 ok / 0 ko / 11 annulés) | Hook before() : partnerToken obtenu | NON PORTABLE — 5 UUID distants → loadFixtures() ; supprimer la réécriture de comptes | 3 : scan-security-1, client-ux-9, scan-security-14 → lot 4 |
| 22 | ticket-scanned-notifications | ÉCHOUE (0 ok / 0 ko / 5 annulés) | Hook before() : Token Contrôleur généré | NON PORTABLE — 4 UUID distants → loadFixtures() ; supprimer la réécriture de comptes | 5 : scan-security-5, client-ux-8, scan-security-1, client-ux-9, controller-ux-11, scan-security-2, partner-ux-1, scan-security-11 → lot 4 |
| 23 | checkout-mixed-cart | ÉCHOUE (0 ok / 0 ko / 5 annulés) | Hook before() : Token acheteur obtenu | NON PORTABLE — 3 UUID distants → loadFixtures() ; supprimer la réécriture de comptes | 3 : ticketing-finance-1, ticketing-finance-16, payment-security-12 → lot 2 |
| 24 | hold-cart-stock | ÉCHOUE (0 ok / 0 ko / 8 annulés) | Hook before() : Event creation: insert or update on table "events" violates foreign key constraint "events_partner_id_fkey" | NON PORTABLE — 5 UUID distants → loadFixtures() | 5 : payment-security-1, ticketing-finance-1, client-ux-1, payment-security-15, ticketing-finance-2, payment-security-6 → lot 2 |
| 25 | ticket-transfers-phase1-schema | ÉCHOUE (0 ok / 0 ko / 12 annulés) | Hook before() : Event creation: insert or update on table "events" violates foreign key constraint "events_partner_id_fkey" | NON PORTABLE — 5 UUID distants → loadFixtures() ; supprimer la réécriture de comptes | — |
| 26 | ticket-transfer-phase2-initiation ¹ | ÉCHOUE (0 ok / 0 ko / 9 annulés) | Hook before() : Event creation: insert or update on table "events" violates foreign key constraint "events_partner_id_fkey" | NON PORTABLE — 4 UUID distants → loadFixtures() | — |
| 27 | ticket-transfer-phase3-claim ¹ | ÉCHOUE (0 ok / 0 ko / 18 annulés) | Hook before() : Event creation: insert or update on table "events" violates foreign key constraint "events_partner_id_fkey" | NON PORTABLE — 4 UUID distants → loadFixtures() | — |
| 28 | ticket-pdf-and-exports ¹ | ÉCHOUE (0 ok / 0 ko / 12 annulés) | Hook before() : Event creation: insert or update on table "events" violates foreign key constraint "events_partner_id_fkey" | NON PORTABLE — 4 UUID distants → loadFixtures() | 1 : scan-security-1 → lot 4 |
| 29 | partner-dashboard-and-exports ¹ | ÉCHOUE (0 ok / 0 ko / 0 annulés) | insert or update on table "events" violates foreign key constraint "events_partner_id_fkey" | NON PORTABLE — 6 UUID distants → loadFixtures() | 1 : ticketing-finance-1, partner-ux-8 → lot 2 |
| 30 | event-cancellation-and-refunds ¹ | ÉCHOUE (1 ok / 7 ko / 0 annulés) | Partenaire A trouvé en base | NON PORTABLE — 3 UUID distants → loadFixtures() | 1 : ticketing-finance-3, ticketing-finance-4, ticketing-finance-6 → lot 2 |
| 31 | event-live-editing-and-stock ¹ | ÉCHOUE (0 ok / 9 ko / 0 annulés) | The expression evaluated to a falsy value: assert.ok(partnerA?.id) | NON PORTABLE — 3 UUID distants → loadFixtures() | — |

¹ Classification établie manuellement (exécution CI + lecture ciblée) : l'agent d'inventaire de cette suite a été interrompu par la limite d'usage.

**Totaux (31 suites) :** 9 passent, 22 échouent ; 21 non portables ; 25 encodent au moins un comportement fautif (62 assertions fautives au total).

### 4.b Suites présentes dans tests/ mais absentes de l'ancienne chaîne `npm test`

Ces 12 fichiers n'étaient pas exécutés par l'ancien script. Le nouveau lanceur les découvre automatiquement ; ils ont donc été exécutés dans le même run. Ils ne font pas partie des 31 suites demandées et n'ont pas reçu d'inventaire statique.

| Suite | Exécution (CI run 3) | Cause en une ligne | Suite après le lot 0 |
|---|---|---|---|
| admin-anonymize | ÉCHOUE (0 ok / 1 ko / 0 annulés) | Après anonymisation, l'email Auth n'est pas brouillé (obtenu l'email d'origine, attendu <id>@deleted.eventvillage.sn) : défaut applicatif probable, hors périmètre événementiel. | tests/legacy/ |
| cdc-v3-validation-checks | ÉCHOUE (2 ok / 4 ko / 0 annulés) | INSERT events viole events_partner_id_fkey : UUID partenaire distant codé en dur (4 sous-tests). | tests/legacy/ |
| chunk5-phase1-bugs | ÉCHOUE (0 ok / 0 ko / 4 annulés) | Hook before() : Cannot read properties of null (reading 'id') — compte distant introuvable. | tests/legacy/ |
| chunk5-phase2-b2c | ÉCHOUE (0 ok / 0 ko / 8 annulés) | Hook before() : INSERT events viole events_partner_id_fkey (UUID distant). | tests/legacy/ |
| controller-complete-workflow | ÉCHOUE (0 ok / 0 ko / 4 annulés) | Hook before() : « Invalid login credentials » — compte contrôleur distant. | tests/legacy/ |
| controller-event-status-hotfix | ÉCHOUE (0 ok / 0 ko / 15 annulés) | Hook before() : Cannot read properties of null (reading 'id') — compte distant introuvable. | tests/legacy/ |
| late-webhook-and-treasury-preflight | ÉCHOUE (0 ok / 2 ko / 0 annulés) | assert.ok(partner?.id) : partenaire distant introuvable (2 sous-tests). | tests/legacy/ |
| partner-events-m5 | ÉCHOUE (0 ok / 6 ko / 0 annulés) | Réécrit le compte distant e706a7a2-… (email, mot de passe) puis échoue à créer son partenaire : clé étrangère (6 sous-tests). | tests/legacy/ |
| partner-halls-m7 | PASSE (4 tests) | — | tests/ (npm test) |
| partner-orders-m9 | PASSE (5 tests) | — | tests/ (npm test) |
| partner-tables-m8 | ÉCHOUE (0 ok / 0 ko / 0 annulés) | Création du 2e compte sans téléphone : handle_new_user écrit phone = '' et users.phone est UNIQUE → « Database error creating new user » (défaut applicatif réel). | tests/legacy/ |
| ux-performance-and-double-click | PASSE (2 tests) | — | tests/ (npm test) |

---

## 5. Sortie brute de `npm run verify`

Run CI 6 (`41200635321`, commit `70da199`). Sortie complète : `docs/lot0-logs/ci-run6-verify.log` (1187 lignes). Ci-dessous, les blocs verbatim de chaque étape ; seule la sortie détaillée des suites, entre l'en-tête de l'étape test et son récapitulatif, est omise ici et figure intégralement dans le fichier joint.

```text

> event-village@1.0.0 verify
> node scripts/verify.mjs


═══════════════ verify › typecheck : npm run typecheck ═══════════════

> event-village@1.0.0 typecheck
> tsc --noEmit


═══════════════ verify › lint : npm run lint ═══════════════

> event-village@1.0.0 lint
> next lint

✔ No ESLint warnings or errors

═══════════════ verify › test : npm run test ═══════════════

> event-village@1.0.0 test
> node scripts/run-tests.mjs

[run-tests] 13 suite(s) — garde-fou : tests/helpers/env.ts — délai/suite : 600.0s
[… 938 lignes de sortie des suites, intégralement dans docs/lot0-logs/ci-run6-verify.log …]
═══════════════════ RÉCAPITULATIF ═══════════════════
Suite                                          Statut   Durée     Code  Journal
tests/auth-rbac.test.ts                        PASS     301ms     0     .test-logs/tests__auth-rbac.test.ts.log
tests/e2e-scenarios.test.ts                    PASS     508ms     0     .test-logs/tests__e2e-scenarios.test.ts.log
tests/fondations-lot0.test.ts                  PASS     473ms     0     .test-logs/tests__fondations-lot0.test.ts.log
tests/notifications-and-documents.test.ts      PASS     240ms     0     .test-logs/tests__notifications-and-documents.test.ts.log
tests/partner-auth-complete.test.ts            PASS     512ms     0     .test-logs/tests__partner-auth-complete.test.ts.log
tests/partner-halls-m7.test.ts                 PASS     1.3s      0     .test-logs/tests__partner-halls-m7.test.ts.log
tests/partner-orders-m9.test.ts                PASS     1.5s      0     .test-logs/tests__partner-orders-m9.test.ts.log
tests/payment.test.ts                          PASS     240ms     0     .test-logs/tests__payment.test.ts.log
tests/roles-isolation.test.ts                  PASS     260ms     0     .test-logs/tests__roles-isolation.test.ts.log
tests/scanner-combat-ui.test.ts                PASS     417ms     0     .test-logs/tests__scanner-combat-ui.test.ts.log
tests/scanner-wolof-audio.test.ts              PASS     423ms     0     .test-logs/tests__scanner-wolof-audio.test.ts.log
tests/superadmin-complete.test.ts              PASS     449ms     0     .test-logs/tests__superadmin-complete.test.ts.log
tests/ux-performance-and-double-click.test.ts  PASS     741ms     0     .test-logs/tests__ux-performance-and-double-click.test.ts.log
──────────────────────────────────────────────────────
TOTAL : 13 suite(s) — 13 réussie(s), 0 en échec, 0 expirée(s)

═══════════════ verify › build : npm run build ═══════════════

> event-village@1.0.0 build
> next build

  ▲ Next.js 14.2.35

   Creating an optimized production build ...
<w> [webpack.cache.PackFileCacheStrategy] Serializing big strings (108kiB) impacts deserialization performance (consider using Buffer instead and decode when needed)
<w> [webpack.cache.PackFileCacheStrategy] Serializing big strings (259kiB) impacts deserialization performance (consider using Buffer instead and decode when needed)
 ✓ Compiled successfully
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/53) ...
[getServerSessionUser] Erreur session: B [Error]: Dynamic server usage: Route /api/partner/orders couldn't be rendered statically because it used `request.headers`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error
    at V (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:21778)
    at Object.get (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:29465)
    at s (/home/runner/work/event-village/event-village/.next/server/chunks/7738.js:422:6202)
    at u (/home/runner/work/event-village/event-village/.next/server/chunks/3138.js:1:403)
    at c (/home/runner/work/event-village/event-village/.next/server/app/api/partner/orders/route.js:1:568)
    at /home/runner/work/event-village/event-village/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:38417
    at /home/runner/work/event-village/event-village/node_modules/next/dist/server/lib/trace/tracer.js:140:36
    at NoopContextManager.with (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:7062)
    at ContextAPI.with (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:518)
    at NoopTracer.startActiveSpan (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:18093) {
  description: "Route /api/partner/orders couldn't be rendered statically because it used `request.headers`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error",
  digest: 'DYNAMIC_SERVER_USAGE'
}
   Generating static pages (13/53) 
   Generating static pages (26/53) 
   Generating static pages (39/53) 
 ✓ Generating static pages (53/53)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                             Size     First Load JS
┌ ○ /                                                   6.45 kB         119 kB
├ ○ /_not-found                                         177 B          87.8 kB
├ ○ /admin                                              177 B          87.8 kB
├ ○ /admin/audit                                        4.53 kB         108 kB
├ ○ /admin/communications                               5.56 kB         109 kB
├ ○ /admin/dashboard                                    13.1 kB         117 kB
├ ○ /admin/finance                                      4.02 kB         108 kB
├ ○ /admin/pricing                                      5.2 kB          109 kB
├ ○ /admin/referral                                     6.81 kB         110 kB
├ ○ /admin/services                                     5.96 kB         110 kB
├ ○ /admin/users                                        24.9 kB         141 kB
├ ƒ /api/admin/audit                                    0 B                0 B
├ ƒ /api/admin/communications                           0 B                0 B
├ ƒ /api/admin/events/[id]/cancel                       0 B                0 B
├ ƒ /api/admin/finance/reconciliation                   0 B                0 B
├ ƒ /api/admin/metrics                                  0 B                0 B
├ ƒ /api/admin/partners                                 0 B                0 B
├ ƒ /api/admin/partners/[id]/status                     0 B                0 B
├ ƒ /api/admin/permissions                              0 B                0 B
├ ƒ /api/admin/pricing                                  0 B                0 B
├ ƒ /api/admin/promotions                               0 B                0 B
├ ƒ /api/admin/refunds/[id]/retry                       0 B                0 B
├ ƒ /api/admin/services                                 0 B                0 B
├ ƒ /api/admin/shifts/audit                             0 B                0 B
├ ƒ /api/admin/users                                    0 B                0 B
├ ƒ /api/admin/users/[id]/anonymize                     0 B                0 B
├ ƒ /api/auth/me                                        0 B                0 B
├ ƒ /api/auth/register                                  0 B                0 B
├ ƒ /api/auth/resolve-phone                             0 B                0 B
├ ƒ /api/auth/send-otp                                  0 B                0 B
├ ƒ /api/auth/sign-out-global                           0 B                0 B
├ ƒ /api/auth/sms-hook                                  0 B                0 B
├ ƒ /api/auth/verify-otp                                0 B                0 B
├ ƒ /api/checkout                                       0 B                0 B
├ ƒ /api/controller/assignments                         0 B                0 B
├ ƒ /api/controller/profile                             0 B                0 B
├ ƒ /api/controller/scan                                0 B                0 B
├ ƒ /api/controller/setup                               0 B                0 B
├ ƒ /api/controller/shifts/[id]/summary                 0 B                0 B
├ ƒ /api/controller/shifts/active                       0 B                0 B
├ ƒ /api/controller/shifts/close                        0 B                0 B
├ ƒ /api/controller/shifts/open                         0 B                0 B
├ ƒ /api/cron/moratoriums                               0 B                0 B
├ ƒ /api/cron/ticket-transfers                          0 B                0 B
├ ƒ /api/events                                         0 B                0 B
├ ƒ /api/events/[id]                                    0 B                0 B
├ ƒ /api/events/[id]/tickets/purchase                   0 B                0 B
├ ƒ /api/halls                                          0 B                0 B
├ ƒ /api/halls/[id]                                     0 B                0 B
├ ƒ /api/halls/reserve                                  0 B                0 B
├ ƒ /api/notifications                                  0 B                0 B
├ ƒ /api/notifications/[id]/read                        0 B                0 B
├ ƒ /api/orders                                         0 B                0 B
├ ƒ /api/orders/create                                  0 B                0 B
├ ƒ /api/partner/activation                             0 B                0 B
├ ƒ /api/partner/dashboard                              0 B                0 B
├ ƒ /api/partner/documents/signed-url                   0 B                0 B
├ ƒ /api/partner/documents/upload                       0 B                0 B
├ ƒ /api/partner/events                                 0 B                0 B
├ ƒ /api/partner/events/[id]                            0 B                0 B
├ ƒ /api/partner/events/[id]/cancel                     0 B                0 B
├ ƒ /api/partner/events/[id]/cancellation               0 B                0 B
├ ƒ /api/partner/events/[id]/categories                 0 B                0 B
├ ƒ /api/partner/events/[id]/categories/[categoryId]    0 B                0 B
├ ƒ /api/partner/events/[id]/promotion                  0 B                0 B
├ ƒ /api/partner/events/[id]/regisseur-pin              0 B                0 B
├ ƒ /api/partner/events/[id]/shifts                     0 B                0 B
├ ƒ /api/partner/events/[id]/status                     0 B                0 B
├ ƒ /api/partner/events/[id]/tickets/[ticketId]/refund  0 B                0 B
├ ƒ /api/partner/finance                                0 B                0 B
├ ƒ /api/partner/halls                                  0 B                0 B
├ ƒ /api/partner/halls/[id]                             0 B                0 B
├ ƒ /api/partner/halls/reservations/[id]/status         0 B                0 B
├ ƒ /api/partner/metrics                                0 B                0 B
├ ƒ /api/partner/orders                                 0 B                0 B
├ ƒ /api/partner/orders/[id]                            0 B                0 B
├ ƒ /api/partner/products                               0 B                0 B
├ ƒ /api/partner/products/[id]                          0 B                0 B
├ ƒ /api/partner/products/[id]/status                   0 B                0 B
├ ƒ /api/partner/profile                                0 B                0 B
├ ƒ /api/partner/register                               0 B                0 B
├ ƒ /api/partner/reports/accounting                     0 B                0 B
├ ƒ /api/partner/reports/closing                        0 B                0 B
├ ƒ /api/partner/reports/closing/pdf                    0 B                0 B
├ ƒ /api/partner/stats                                  0 B                0 B
├ ƒ /api/partner/subscription                           0 B                0 B
├ ƒ /api/partner/tables                                 0 B                0 B
├ ƒ /api/partner/tables/[id]                            0 B                0 B
├ ƒ /api/partner/tables/reservations                    0 B                0 B
├ ƒ /api/partner/tables/reservations/[id]               0 B                0 B
├ ƒ /api/partner/team/[eventId]                         0 B                0 B
├ ƒ /api/partner/team/all                               0 B                0 B
├ ƒ /api/partner/team/assignments                       0 B                0 B
├ ƒ /api/partner/team/controller/[controllerId]         0 B                0 B
├ ƒ /api/partner/team/invite                            0 B                0 B
├ ƒ /api/partner/upload                                 0 B                0 B
├ ƒ /api/payments/[transactionId]/status                0 B                0 B
├ ƒ /api/payments/create                                0 B                0 B
├ ƒ /api/referrals/my-stats                             0 B                0 B
├ ƒ /api/restaurants/[id]/menu                          0 B                0 B
├ ƒ /api/restaurants/[id]/tables                        0 B                0 B
├ ƒ /api/restaurants/reserve-table                      0 B                0 B
├ ƒ /api/test-notify-superadmins                        0 B                0 B
├ ƒ /api/tickets                                        0 B                0 B
├ ƒ /api/tickets/[id]/live-code                         0 B                0 B
├ ƒ /api/tickets/[id]/pdf                               0 B                0 B
├ ƒ /api/tickets/[id]/transfer                          0 B                0 B
├ ƒ /api/tickets/claim-free                             0 B                0 B
├ ƒ /api/tickets/claim/[token]                          0 B                0 B
├ ƒ /api/tickets/transfers/[id]/cancel                  0 B                0 B
├ ƒ /api/tickets/verify                                 0 B                0 B
├ ƒ /api/webhooks/samirpay                              0 B                0 B
├ ƒ /api/withdrawals/request                            0 B                0 B
├ ○ /controller/profile                                 5.94 kB         110 kB
├ ○ /controller/scanner                                 14.8 kB         196 kB
├ ○ /controller/setup                                   4.59 kB         168 kB
├ ƒ /events/[id]                                        9.37 kB         195 kB
├ ○ /explore                                            3.94 kB         116 kB
├ ○ /forgot-password                                    8.86 kB         194 kB
├ ○ /halls                                              5.25 kB         114 kB
├ ƒ /halls/[id]                                         5.72 kB         192 kB
├ ○ /login                                              10.7 kB         196 kB
├ ○ /notifications                                      6.33 kB         179 kB
├ ○ /orders                                             6.45 kB         179 kB
├ ○ /partner                                            177 B          87.8 kB
├ ○ /partner/calendar                                   4.53 kB         108 kB
├ ○ /partner/dashboard                                  13.8 kB         186 kB
├ ○ /partner/events                                     6.85 kB         122 kB
├ ƒ /partner/events/[id]/caisse                         6.97 kB         115 kB
├ ƒ /partner/events/[id]/edit                           6.66 kB         128 kB
├ ƒ /partner/events/[id]/team                           5.09 kB         182 kB
├ ○ /partner/events/new                                 9.57 kB         131 kB
├ ○ /partner/finance                                    4.84 kB         199 kB
├ ○ /partner/halls                                      3.73 kB         119 kB
├ ƒ /partner/halls/[id]/edit                            4.74 kB         126 kB
├ ○ /partner/halls/new                                  4.23 kB         126 kB
├ ○ /partner/orders                                     4.53 kB         185 kB
├ ○ /partner/products                                   3.01 kB         118 kB
├ ○ /partner/products/new                               3.89 kB         125 kB
├ ○ /partner/profile                                    4.34 kB        99.2 kB
├ ○ /partner/register                                   9.53 kB         126 kB
├ ○ /partner/scan                                       4.93 kB         113 kB
├ ○ /partner/stats                                      5.5 kB          100 kB
├ ○ /partner/subscription                               5.8 kB          109 kB
├ ○ /partner/tables                                     5.38 kB         120 kB
├ ○ /partner/team                                       9.41 kB         187 kB
├ ○ /profile                                            7.35 kB         180 kB
├ ○ /register                                           9.4 kB          195 kB
├ ○ /reset-password                                     7.65 kB         180 kB
├ ƒ /restaurants/[id]/menu                              4.91 kB         191 kB
├ ƒ /restaurants/[id]/tables                            5.27 kB         191 kB
├ ○ /scan                                               177 B          87.8 kB
├ ○ /tickets                                            16.1 kB         239 kB
├ ƒ /tickets/claim/[token]                              4.58 kB         227 kB
└ ○ /wallet                                             8.96 kB         173 kB
+ First Load JS shared by all                           87.6 kB
  ├ chunks/2117-488d789e9004e22c.js                     31.9 kB
  ├ chunks/fd9d1056-270721ac51469ce4.js                 53.6 kB
  └ other shared chunks (total)                         2.1 kB


ƒ Middleware                                            87 kB

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand


[verify] OK — 4 étapes réussies en 87s.
```

Vérifications locales (poste Windows, sans Docker) : `docs/lot0-logs/local-verification.txt`.

```text
$ npx tsc --noEmit
TSC_EXIT=0

$ npx next lint
✔ No ESLint warnings or errors
```

---

## 6. Runs CI

| Run | Commit | Résultat | Cause |
|---|---|---|---|
| [1 · 41160524214](https://github.com/fallouu-mn/event-village/actions/runs/41160524214) | 607bd53 | échec | Seed : création d'utilisateur refusée (cause identifiée au run 2) |
| [2 · 41161003155](https://github.com/fallouu-mn/event-village/actions/runs/41161003155) | 9bae9a1 | échec | Seed : `Database error creating new user` → correction `search_path` |
| [3 · 41161426009](https://github.com/fallouu-mn/event-village/actions/runs/41161426009) | d54a8ab | échec | Tests : 31 suites héritées sur 43 en échec → quarantaine (run d'inventaire) |
| [4 · 41162020303](https://github.com/fallouu-mn/event-village/actions/runs/41162020303) | 90fdcc2 | **succès** | — |
| [5 · 41199375190](https://github.com/fallouu-mn/event-village/actions/runs/41199375190) | c6956a7 | échec | Build : chargeur `next/font/google` (« Cannot read properties of null (reading '1') ») → police auto-hébergée |
| [6 · 41200635321](https://github.com/fallouu-mn/event-village/actions/runs/41200635321) | 70da199 | **succès** | — (run de référence) |

**Lien du run de référence : https://github.com/fallouu-mn/event-village/actions/runs/41200635321**

Les journaux bruts de chaque run sont publiés sur la branche `ci-results` (dossier `runs/<numéro>-<id>/`), car l'API GitHub refuse de servir les journaux de job sans authentification.

---

## 7. Blocages et points ouverts

### À traiter en priorité

1. **Le dépôt est public, et le rapport d'audit y est désormais publié.** `fallouu-mn/event-village` est public (vérifié par l'API GitHub avant le premier push). Le push de `fix/evenementiel` a rendu lisibles `docs/audit-evenementiel-cdc-v3.md` et son annexe, qui décrivent des failles exploitables contre le projet Supabase réel : auto-attribution du rôle SUPERADMIN à l'inscription, codes OTP lisibles sans authentification, webhook de paiement non authentifié. Le code source était déjà public, mais le rapport rend ces failles évidentes. Je n'ai pas changé la visibilité du dépôt : c'est une action externe qui vous revient. Recommandation : passer le dépôt en privé maintenant, puis traiter en correctif urgent les deux failles du lot 3 exploitables sans compte (rôle lu dans les métadonnées d'inscription, `otp_codes` sans RLS).
2. **Le projet Supabase distant devra être réaligné avant tout `supabase db push`.** Les dix-huit migrations renommées ont de nouvelles versions : sans `supabase migration repair` (anciennes versions en `reverted`, nouvelles en `applied`), le CLI tenterait de les rejouer. La migration `20261031000001_functions_search_path.sql` est la seule nouvelle à appliquer.
3. **Variables d'environnement désormais obligatoires.** `lib/env.ts` est appelé par tous les clients Supabase serveur : sans `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `SAMIRPAY_API_URL`, `SAMIRPAY_API_KEY` et `SAMIRPAY_SECRET_KEY`, chaque route serveur échoue avec un message listant les variables manquantes. Vérifier l'environnement de production avant de déployer cette branche.

### Blocages d'environnement

4. **Docker est absent du poste de développement.** `supabase start` y échoue (`docker: command not found`). Toutes les exécutions sur base locale ont donc eu lieu en CI. Pour la boucle de travail locale des lots suivants, installer Docker Desktop.
5. **Accès aux journaux CI.** `gh` n'est pas installé et l'API refuse les journaux sans authentification (HTTP 403). Ma tentative d'utiliser le jeton Git enregistré sur le poste a été refusée par le contrôle de permissions ; je ne l'ai pas contournée. Les journaux passent par la branche `ci-results`, publique comme le dépôt. Elle ne contient que des données de test fictives et les clés de démonstration publiques de Supabase local.
6. **CI sensible aux quotas de registre.** Le démarrage de Supabase en CI subit des refus `toomanyrequests: Data limit exceeded` sur `public.ecr.aws`, résolus par les relances automatiques. Si cela s'aggrave : cache des images Docker ou miroir.

### Défauts découverts pendant le lot (non corrigés : hors périmètre du lot 0)

7. **`handle_new_user` empêche la création d'un deuxième compte sans téléphone.** Le trigger écrit `phone = ''` quand le téléphone est absent, et `users.phone` est `UNIQUE` : le deuxième compte créé sans téléphone échoue (« Database error creating new user »). Mis en évidence par `partner-tables-m8`. À traiter au lot 3, avec la réécriture de `handle_new_user`.
8. **Anonymisation RGPD incomplète.** `admin-anonymize` montre que l'email Auth n'est pas brouillé après anonymisation (email d'origine conservé, attendu `<id>@deleted.eventvillage.sn`). Hors périmètre événementiel, à arbitrer.
9. **`getServerSessionUser` avale toutes les erreurs**, y compris le signal interne de Next au build (« Dynamic server usage … `request.headers` », journalisé comme « Erreur session »). Dix handlers GET n'ont pas `export const dynamic = 'force-dynamic'`. Aucune route API n'est pour autant figée au build : toutes sont dynamiques dans les runs 4 et suivants. À traiter au lot 3.

### Limites des tests à ce stade

10. **Sept suites restées dans `npm test` encodent des comportements fautifs** (`payment`, `e2e-scenarios`, `auth-rbac`, `superadmin-complete`, `partner-auth-complete`, `roles-isolation`, `scanner-wolof-audio`). Elles passent aujourd'hui parce que le code est encore fautif. Elles échoueront quand les lots 2 à 5 corrigeront ces comportements ; elles seront alors réécrites, et chaque réécriture sera signalée.
11. **Trois suites hors chaîne d'origine** (`partner-halls-m7`, `partner-orders-m9`, `ux-performance-and-double-click`) passent et restent dans `npm test` sans inventaire statique.
12. **Six suites ont été classées manuellement** (`ticket-transfer-phase2-initiation`, `ticket-transfer-phase3-claim`, `ticket-pdf-and-exports`, `partner-dashboard-and-exports`, `event-cancellation-and-refunds`, `event-live-editing-and-stock`) : leurs agents de lecture ont été interrompus par une limite d'usage. Leur fiche est moins détaillée.
13. **Le schéma de signature des webhooks simulés est provisoire** (HMAC-SHA256 de `order_id|transaction_id|status|amount|currency`, champ `signature` et en-tête `x-samirpay-signature`). Il sera aligné sur la documentation SamirPay au lot 2.

### Dette technique signalée

14. **Replis à retirer au lot 4** (listés en tête de `lib/env.ts`, non modifiés) :
    - `lib/security/totp.ts` L18 : clé HMAC de dérivation TOTP = `SUPABASE_AUTH_HOOK_SECRET || SUPABASE_SERVICE_ROLE_KEY || 'event-village-totp-master-salt-2026'` ;
    - `lib/shifts/shift.service.ts` L51 : sel du PIN régisseur, même chaîne avec `'event-village-regisseur-pin-salt-2026'` ;
    - `app/api/cron/moratoriums/route.ts` L22 et `app/api/cron/ticket-transfers/route.ts` L22 : `CRON_SECRET || SUPABASE_SERVICE_ROLE_KEY`, cron non protégé si les deux manquent.

    Autres valeurs par défaut relevées : `NEXT_PUBLIC_APP_URL || 'https://eventvillage.sn'` dans `lib/email/email.service.ts` L21, `lib/payments/payment.service.ts` L328, `lib/tickets/ticket-transfer.service.ts` L320, `app/api/checkout/route.ts` L224 ; `|| 'http://localhost:3000'` dans `app/api/partner/team/invite/route.ts` L376 (lien d'activation contrôleur faux en production si la variable manque) ; identifiant de service MTarget `'36233'` par défaut.
15. **`.npmrc` avec `legacy-peer-deps=true`.** Sans lui, toute installation échoue : `liquid-glass-react@1.1.1` exige React 19, le projet est en React 18. Ce paquet n'est importé nulle part : le retirer (lot 5) permettra de supprimer `.npmrc`.
16. **Correctifs ESLint.** Les deux avertissements `@next/next/no-img-element` sont neutralisés par un commentaire justifié (QR de paiement en data URL, aperçu local avant upload), pas corrigés : `next/image` ne s'applique pas à ces sources. Les quatre avertissements `react-hooks/exhaustive-deps` sont corrigés ; l'objet `toast` est désormais mémoïsé pour que ces dépendances ne relancent pas les effets.
17. **Police auto-hébergée.** `app/layout.tsx` charge Plus Jakarta Sans depuis `app/fonts/` au lieu de Google Fonts. Même famille, même variable CSS, sous-ensemble latin identique. La plage de graisses passe de 400-800 à la police variable complète 200-800.
18. **Valeurs non secrètes dans le code de test.** Mot de passe commun des comptes de test (`TEST_PASSWORD`, `tests/helpers/fixtures.ts`), utilisable uniquement sur une instance locale seedée ; clés de démonstration publiques de Supabase local dans `.env.test.example`.
19. **`supabase/config.toml`** : section `[inbucket]` dépréciée (avertissement du CLI), à renommer en `[local_smtp]`.

Le lot 1 n'a pas été commencé.
