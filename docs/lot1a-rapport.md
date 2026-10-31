# LOT 1A — RAPPORT

**Objet :** correctif d'urgence des failles exploitables sans privilège (clé anon publique ou compte gratuit).
**Branche :** `fix/evenementiel`. Aucun push sur `main`. **Rien n'a été exécuté contre le projet Supabase distant.**
**Date :** 31 octobre 2026.

**Résultat :** les sept défauts du périmètre sont corrigés et prouvés par des tests qui échouaient sur la base d'origine (run CI 8) et passent après correctif (runs 9 et 13). `npm run verify` est vert : https://github.com/fallouu-mn/event-village/actions/runs/41206780999. Les scripts pour le projet de test sont dans `supabase/hotfix/2026-10-31-lot1a/`, validés sur une base locale ; la procédure du futur projet de production est dans `docs/deploiement-projet-neuf.md`.

---

## ⚠ Secrets — à lire en premier

| Secret | Trouvé dans l'historique public ? | Action |
|---|---|---|
| Clés SamirPay (`SAMIRPAY_API_KEY`, `SAMIRPAY_SECRET_KEY`, `SAMIRPAY_WEBHOOK_SECRET`) | **Non** | Aucune rotation imposée par le dépôt. Utiliser des clés neuves pour la production. |
| Identifiants MTarget (`MTARGET_USERNAME`, `MTARGET_PASSWORD`) | **Non** | Idem. |
| Clé email Resend (`RESEND_API_KEY`) | **Non** | Idem. |
| Clés Supabase du projet de test (`anon`, `service_role`) | **Non** | Le projet de test sera abandonné ; ne pas les reprendre. |
| **`SUPABASE_AUTH_HOOK_SECRET`** (valeur réelle) | **OUI** : `tests/mtarget-sms.test.ts` ligne 83, commits `7489bf3` et `9b2d5ab` du 29/08/2026, présent sur `main` | **Faire tourner immédiatement** (section 5). |

Ce secret signe les appels du hook SMS de Supabase Auth vers `/api/auth/sms-hook`. Il permet de forger ces appels et donc de **faire envoyer des SMS facturés sur le compte MTarget réel**, vers n'importe quel numéro. Il sert aussi aujourd'hui de clé de dérivation des QR dynamiques et de sel des PIN régisseur. La valeur a été retirée du fichier courant (commit `5a20ad5`) mais reste lisible dans l'historique : seule la rotation protège.

**Fonction `exec_sql` sur le projet de test.** Le fichier local `.claude/settings.local.json`, jamais versionné, contient des commandes `curl` d'un agent vers `…/rest/v1/rpc/exec_sql` du projet distant, avec une clé. Cette fonction n'existe dans aucune migration du dépôt. Si elle est exécutable par anon, n'importe qui peut lancer du SQL arbitraire sur ce projet. La section G de `01-detection.sql` la recherche ; `02-hotfix.sql` la supprime. Supprimer aussi ces lignes de `.claude/settings.local.json`, qui contient une clé du projet.

---

## 1. Commits

| Hash | Message | Tâche |
|---|---|---|
| 24cb5a1 | test(infra): base de test pour le lot 1A (catalogue Postgres local, fixtures sans service_role, billet de référence) | infrastructure |
| 5b510eb | test(securite): tests rouges du lot 1A (anon uniquement) + catalogue + parcours serveur | tests rouges 1A.1 à 1A.6 |
| 5a20ad5 | fix(secrets): retirer la valeur réelle de SUPABASE_AUTH_HOOK_SECRET d'un test | 1A.8 |
| 766d18c | fix(securite)[1A.1]: inscription sans élévation de rôle, attribution des rôles par le serveur | 1A.1 |
| 11488c5 | fix(securite)[1A.2]: otp_codes fermée aux rôles API (RLS sans politique, REVOKE ALL) | 1A.2 |
| 4263c8d | fix(securite)[1A.3]: droits EXECUTE minimaux sur les fonctions de public | 1A.3 |
| 1427fdb | fix(securite)[1A.4]: plus d'écriture directe sur tickets, payments et audit_logs par l'API | 1A.4 |
| 9abb5dd | fix(securite)[1A.5]: plus de profils ni de hash de PIN lisibles par anon | 1A.5 |
| 1228a7a | feat(hotfix)[1A.7]: scripts de détection, correctif, vérification et test de fumée pour le projet de test | 1A.7 |
| 8f1b2b0 | test(hotfix)[1A.7]: exécution des scripts 01, 02 (deux fois) et 03 sur la base locale | 1A.7 |
| 86cd0b8 | docs(deploiement): procédure de montage du futur projet de production depuis zéro | complément 2 |
| 0ff3529 | fix(hotfix)[1A.7]: 03 — cast de provolatile ; 01 — gravité selon la trace d'attribution serveur | 1A.7 |
| dd5fa41 | test(hotfix)[1A.7]: section A de 01-detection — gravité par rôle réclamé sur des comptes synthétiques | 1A.7 |
| b6e542e | fix(hotfix)[1A.7]: 01-detection section A — une ligne par rôle élevé réclamé, gravité selon user_roles et la trace serveur | 1A.7 |

Ce rapport est ajouté par le commit qui suit `b6e542e`. La tâche 1A.6 n'a pas de commit de code : ses deux garde-fous sont des tests (commit `5b510eb`), et la seule table sans RLS, `otp_codes`, est corrigée par 1A.2.

Écart d'hygiène : la restructuration du test de parcours OTP (qui relève de 1A.2) est partie dans le commit de 1A.1 (`766d18c`).

### Règles de test appliquées

- **Tests de sécurité (`tests/security`)** : uniquement la clé anon, `signUp` et `signInWithPassword`. Le test `anon-uniquement.test.ts` échoue si un fichier du dossier mentionne le `service_role`, `auth.admin` ou les chargeurs de fixtures qui l'utilisent. Les identifiants d'événements y sont découverts comme le ferait un visiteur (lecture publique par slug).
- **Tests de catalogue (`tests/schema`)** : la RLS par table et les privilèges `EXECUTE` ne sont pas exposés par l'API REST. Ces tests lisent le catalogue de la base **locale** par une connexion Postgres directe (`SUPABASE_DB_URL`, refusée si l'hôte n'est pas local), en transaction `READ ONLY`. Le seul essai qui écrit (fonction sonde des privilèges par défaut) est systématiquement annulé (`ROLLBACK`). Ils n'utilisent pas le `service_role`.
- **Tests de parcours (`tests/parcours`)** : tests fonctionnels des routes serveur, qui s'exécutent avec leur propre client `service_role` comme en production ; ils lisent la base en `service_role` pour vérifier l'état.

### Tests existants modifiés (signalement)

- **`tests/auth-rbac.test.ts`, test 18 supprimé.** Il affirmait, sur des constantes et sans appeler le code, que les numéros 770000000 et 773780756 devaient être promus SUPERADMIN. Ce comportement est la faille corrigée en 1A.1. Remplacé par `tests/security/r1-inscription-roles.test.ts` et `tests/parcours/bootstrap-superadmin.test.ts`.
- **`tests/legacy/mtarget-sms.test.ts`, ligne 83.** La valeur réelle du secret du hook remplacée par une valeur factice ; la logique du test est inchangée (il calcule lui-même la signature avec ce secret).
- **`tests/parcours/otp-serveur.test.ts`** (créé dans ce lot) restructuré entre le run rouge et le correctif : la version initiale passait par `/api/auth/register`, dont l'écriture dans `otp_codes` échoue toujours (défaut préexistant, section 8). La version finale prouve le chemin base de données par `/api/auth/send-otp`.

---

## 2. Tâches : dépendances, test rouge, correctif, test vert

Les sorties « avant correctif » viennent du run CI 8 (`41203526272`, commit `5b510eb`) ; les sorties « après » du run CI 9 (`41204991502`, commit `9abb5dd`). Extraits verbatim des journaux TAP, journaux complets sur la branche `ci-results` (`runs/8-41203526272/`, `runs/9-41204991502/`).

### 1A.1 — Inscription : plus aucune élévation de rôle (R1)

**Grep de dépendance.** Créations de comptes et lectures de rôle depuis les métadonnées :

```text
$ grep -rn "auth.admin.createUser\|auth.signUp\|\.signUp(" app lib components hooks scripts
app/api/admin/users/route.ts:111:        const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
app/api/auth/register/route.ts:58:        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
app/api/partner/register/route.ts:66:        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
app/api/partner/team/invite/route.ts:252:                const { data: authData, error: authErr } = await supabase.auth.admin.createUser({

$ grep -n "user_roles\|addUserRole\|setUserRoles" app/api/partner/register/route.ts app/api/admin/users/route.ts
(fin)            ← aucune écriture de user_roles : leur rôle effectif venait du trigger lisant user_metadata.role
```

Parcours migrés vers une attribution serveur explicite :

| Parcours | Avant | Après |
|---|---|---|
| Inscription partenaire `/api/partner/register` | `user_metadata.role = 'PARTENAIRE'`, rôle posé par le trigger | `grantUserRoles(userId, ['PARTENAIRE'])`, échec explicite (HTTP 500) si l'écriture échoue |
| Création par un admin `/api/admin/users` | `user_metadata.role = <rôle demandé>`, rôle posé par le trigger | `grantUserRoles(userId, [rôle])`, rôle validé contre une liste fermée |
| Invitation contrôleur `/api/partner/team/invite` | écrivait déjà `user_roles` explicitement | inchangé |
| Bootstrap SUPERADMIN | trigger : téléphone `773780756`, **y compris fourni en métadonnée** | `scripts/bootstrap-superadmin.ts` (service_role, refus si un SUPERADMIN existe, journalisé) |

**Correctif.** `handle_new_user` (section 1A.1 de la migration) : compte toujours CLIENT ; métadonnées ignorées pour le rôle, le téléphone et le bootstrap ; téléphone = `NULLIF(TRIM(NEW.phone), '')` lu dans `auth.users` uniquement ; `SET search_path = public`. Au-delà de la demande, le téléphone n'est plus lu dans les métadonnées : un inscrit pouvait sinon s'approprier le numéro d'un tiers dans `users.phone` (colonne unique, utilisée pour la connexion par téléphone).

**security/r1-inscription-roles**


Run 8 (avant correctif) :

```text
    not ok 1 - signUp avec data.role=SUPERADMIN et data.roles=[SUPERADMIN] → compte CLIENT sans privilège
        → is_admin() doit être faux true !== false
    not ok 2 - signUp avec data.role=ADMIN et data.roles=[ADMIN] → compte CLIENT sans privilège
        → is_admin() doit être faux true !== false
    not ok 3 - signUp avec data.role=PARTENAIRE et data.roles=[PARTENAIRE] → compte CLIENT sans privilège
        → has_role(PARTENAIRE) doit être faux true !== false
    not ok 4 - signUp avec data.role=CONTROLEUR et data.roles=[CONTROLEUR] → compte CLIENT sans privilège
        → is_controller() doit être faux true !== false
    not ok 5 - signUp avec data.phone = numéro de bootstrap SUPERADMIN → aucun privilège
        → téléphone 773780756 en métadonnée : is_superadmin() doit être faux true !== false
    not ok 6 - un téléphone fourni en métadonnée n'est pas recopié dans users.phone (pas d'appropriation de numéro)
        → users.phone doit rester vide (métadonnée non vérifiée), obtenu +221777186241 + actual - expected
    not ok 7 - régression : deux comptes sans téléphone se créent sans erreur
        → signUp(sans-tel-2) refusé : Database error saving new user
not ok 1 - R1 — inscription : aucune élévation de rôle par les métadonnées
        → 7 subtests failed
# pass 0
# fail 7
```

Run 9 (après correctif) :

```text
    ok 1 - signUp avec data.role=SUPERADMIN et data.roles=[SUPERADMIN] → compte CLIENT sans privilège
    ok 2 - signUp avec data.role=ADMIN et data.roles=[ADMIN] → compte CLIENT sans privilège
    ok 3 - signUp avec data.role=PARTENAIRE et data.roles=[PARTENAIRE] → compte CLIENT sans privilège
    ok 4 - signUp avec data.role=CONTROLEUR et data.roles=[CONTROLEUR] → compte CLIENT sans privilège
    ok 5 - signUp avec data.phone = numéro de bootstrap SUPERADMIN → aucun privilège
    ok 6 - un téléphone fourni en métadonnée n'est pas recopié dans users.phone (pas d'appropriation de numéro)
    ok 7 - régression : deux comptes sans téléphone se créent sans erreur
ok 1 - R1 — inscription : aucune élévation de rôle par les métadonnées
# pass 7
# fail 0
```

**parcours/attribution-roles**


Run 8 (avant correctif) :

```text
    not ok 1 - inscription partenaire → PARTENAIRE dans user_roles et dans le jeton
        → le jeton doit porter PARTENAIRE
    not ok 2 - création d'un compte CONTROLEUR par un SUPERADMIN → CONTROLEUR dans user_roles et dans le jeton
        → le jeton doit porter CONTROLEUR
    ok 3 - invitation d'un contrôleur par le partenaire A → CONTROLEUR dans user_roles + affectation
not ok 1 - Attribution des rôles par les routes serveur
        → 2 subtests failed
# pass 1
# fail 2
```

Run 9 (après correctif) :

```text
    ok 1 - inscription partenaire → PARTENAIRE dans user_roles et dans le jeton
    ok 2 - création d'un compte CONTROLEUR par un SUPERADMIN → CONTROLEUR dans user_roles et dans le jeton
    ok 3 - invitation d'un contrôleur par le partenaire A → CONTROLEUR dans user_roles + affectation
ok 1 - Attribution des rôles par les routes serveur
# pass 3
# fail 0
```

Le test de parcours `attribution-roles` était lui aussi rouge avant correctif : `user_roles` contenait bien le rôle, mais le jeton ne le portait pas. Le trigger de synchronisation écrit les rôles dans les métadonnées pendant la création du compte, et GoTrue les écrase ensuite avec les métadonnées d'origine. L'attribution explicite, faite après la création, se synchronise correctement.

**parcours/bootstrap-superadmin**


Run 8 (avant correctif) :

```text
(suite absente de ce run)
```

Run 9 (après correctif) :

```text
    ok 1 - refus quand un SUPERADMIN existe déjà et que l'option n'est pas donnée
    ok 2 - promotion explicite d'un compte existant : rôle, droits RLS et journal
    ok 3 - compte inexistant : refus explicite
ok 1 - Bootstrap SUPERADMIN (scripts/bootstrap-superadmin.ts)
# pass 3
# fail 0
```

### 1A.2 — `otp_codes` (R2)

**Grep de dépendance.** Tous les accès applicatifs à `otp_codes` passent par `getServiceRoleClient` :

```text
$ grep -rn "otp_codes" app lib
app/api/auth/register/route.ts:150:            await (supabaseAdmin.from('otp_codes') as any).insert({
app/api/auth/send-otp/route.ts:85:            await (supabase.from('otp_codes') as any).insert({
app/api/auth/verify-otp/route.ts:79:                const { data: record } = await (supabase.from('otp_codes') as any)
app/api/auth/verify-otp/route.ts:91:                    await (supabase.from('otp_codes') as any)
app/api/controller/setup/route.ts:55:            const { data: dbOtp } = await (supabase.from('otp_codes') as any)
app/api/controller/setup/route.ts:157:            (supabase.from('otp_codes') as any)
app/api/partner/register/route.ts:162:            await (supabase.from('otp_codes') as any).insert({
app/api/partner/team/controller/[controllerId]/route.ts:151:                    await supabase.from('otp_codes').delete().eq('phone', ctrlPr
app/api/partner/team/invite/route.ts:368:            await (supabase.from('otp_codes') as any).insert({
lib/admin/admin.service.ts:364:                await (supabase.from('otp_codes') as any)
lib/security/sensitive-action.service.ts:22:        await supabase.from('otp_codes').insert({
lib/security/sensitive-action.service.ts:56:            .from('otp_codes')

$ grep -n "getServiceRoleClient" lib/security/sensitive-action.service.ts
1:import { getServiceRoleClient } from '@/lib/supabase/server';
15:        const supabase = getServiceRoleClient();
53:        const supabase = getServiceRoleClient();
```

Aucun client navigateur ni client anon côté serveur n'accède à `otp_codes` (`getServerClient` n'est appelé nulle part ; les clients navigateur ne lisent que `users`, `user_roles` et `partners` pour l'utilisateur connecté).

**Correctif.** RLS activée, toute politique supprimée, `REVOKE ALL … FROM PUBLIC, anon, authenticated`, `GRANT ALL … TO service_role`.

**security/r2-otp-codes**


Run 8 (avant correctif) :

```text
    not ok 1 - anon : lecture refusée
        → anon SELECT otp_codes : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    not ok 2 - anon : insertion refusée
        → anon INSERT otp_codes : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    not ok 3 - authenticated (compte CLIENT gratuit) : lecture, insertion, modification et suppression refusées
        → authenticated SELECT otp_codes : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
not ok 1 - R2 — otp_codes inaccessible par anon et authenticated
        → 3 subtests failed
# pass 0
# fail 3
```

Run 9 (après correctif) :

```text
    ok 1 - anon : lecture refusée
    ok 2 - anon : insertion refusée
    ok 3 - authenticated (compte CLIENT gratuit) : lecture, insertion, modification et suppression refusées
ok 1 - R2 — otp_codes inaccessible par anon et authenticated
# pass 3
# fail 0
```

**parcours/otp-serveur**


Run 8 (avant correctif) :

```text
not ok 1 - inscription client → OTP par SMS → vérification serveur via la table otp_codes
        → vérification OTP : HTTP 400 {"error":"Code de vérification incorrect ou expiré."} 400 !== 200
# pass 0
# fail 1
```

Run 9 (après correctif) :

```text
    ok 1 - send-otp → otp_codes (service_role) → verify-otp par la base, cache mémoire vidé
    ok 2 - inscription client → OTP par SMS → verify-otp
ok 1 - Parcours OTP serveur
# pass 2
# fail 0
```

### 1A.3 — Fonctions SECURITY DEFINER (R3)

**Grep de dépendance.** Appels RPC du code applicatif (hors tests) :

```text
$ grep -rn "\.rpc(" app lib components hooks
app/api/controller/scan/route.ts:283:            const { data: lockResult, error: lockErr } = await supabase.rpc('atomic_ticket_checkin', {
app/api/controller/scan/route.ts:508:        const { data: lockResult, error: lockErr } = await supabase.rpc('atomic_ticket_checkin', {
app/api/partner/team/controller/[controllerId]/route.ts:79:        const { data: rpcResult, error: rpcErr } = await supabase.rpc('atomic_partner_remov
lib/payments/withdrawal.service.ts:78:        const { data: rpcResult, error: rpcError } = await supabase.rpc('request_withdrawal', {
lib/tables/table.service.ts:249:        const { data, error } = await supabase.rpc('create_table_reservation_atomic', {
app/api/partner/activation/route.ts:58:            'activate_partner_trial',      ← appel via (supabase.rpc as any)(…)
```

Tous ces appelants utilisent `getServiceRoleClient`. Fonctions sans aucun appelant applicatif : `validate_and_check_in_ticket` (supprimée), `calculate_referral_commissions` (appelée uniquement par le trigger `trg_fn_payment_success_commissions`, SECURITY DEFINER), `has_admin_permission`, `create_hall_reservation_atomic`, `generate_referral_code` (appelée par le trigger `set_referral_code_on_insert`). Deux d'entre elles étaient exploitables avec la seule clé anon : `create_hall_reservation_atomic` et `create_table_reservation_atomic` créent une réservation pour le `p_client_id` passé en paramètre.

**Correctif.** Voir l'inventaire (section 3). Classement automatique par le catalogue, aides RLS en liste blanche explicite, suppression de `validate_and_check_in_ticket` et de toute fonction `exec_sql`. Les aides RLS restent exécutables par **anon** aussi : les politiques sans clause `TO` s'évaluent pour anon, et leur retirer `EXECUTE` aurait cassé la lecture publique des événements.

**Écart par rapport à la consigne.** `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` n'a aucun effet en PostgreSQL : un droit accordé globalement (le défaut `EXECUTE` à `PUBLIC`) ne se révoque pas par schéma. La migration utilise `ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` (global), plus la révocation par schéma des droits que Supabase accorde à anon et authenticated. La fonction sonde du test le prouve : ACL `{=X/postgres,…,anon=X/postgres,authenticated=X/postgres,…}` avant, `{postgres=X/postgres,service_role=X/postgres}` après.

**security/r3-fonctions-rpc**


Run 8 (avant correctif) :

```text
    not ok 1 - anon : rpc(validate_and_check_in_ticket) refusée
        → anon rpc(validate_and_check_in_ticket) : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    not ok 2 - authenticated (compte CLIENT) : rpc(validate_and_check_in_ticket) refusée
        → authenticated rpc(validate_and_check_in_ticket) : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    not ok 3 - anon : rpc(calculate_referral_commissions) refusée
        → anon rpc(calculate_referral_commissions) : refus attendu (permission / RLS / objet inexistant), obtenu code=P0001 message=Paiement non trouvé : 00000000-0000-0000-0000-000000000000
    not ok 4 - authenticated (compte CLIENT) : rpc(calculate_referral_commissions) refusée
        → authenticated rpc(calculate_referral_commissions) : refus attendu (permission / RLS / objet inexistant), obtenu code=P0001 message=Paiement non trouvé : 00000000-0000-0000-0000-000000000000
    not ok 5 - anon : rpc(activate_partner_trial) refusée
        → anon rpc(activate_partner_trial) : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    not ok 6 - authenticated (compte CLIENT) : rpc(activate_partner_trial) refusée
        → authenticated rpc(activate_partner_trial) : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    not ok 7 - anon : rpc(has_admin_permission) refusée
        → anon rpc(has_admin_permission) : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    not ok 8 - authenticated (compte CLIENT) : rpc(has_admin_permission) refusée
        → authenticated rpc(has_admin_permission) : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    not ok 9 - anon : rpc(create_hall_reservation_atomic) refusée
        → anon rpc(create_hall_reservation_atomic) : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    not ok 10 - authenticated (compte CLIENT) : rpc(create_hall_reservation_atomic) refusée
        → authenticated rpc(create_hall_reservation_atomic) : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    not ok 11 - anon : rpc(create_table_reservation_atomic) refusée
        → anon rpc(create_table_reservation_atomic) : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    not ok 12 - authenticated (compte CLIENT) : rpc(create_table_reservation_atomic) refusée
        → authenticated rpc(create_table_reservation_atomic) : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    ok 13 - anon : rpc(request_withdrawal) refusée
    ok 14 - authenticated (compte CLIENT) : rpc(request_withdrawal) refusée
    ok 15 - anon : rpc(atomic_ticket_checkin) refusée
    ok 16 - authenticated (compte CLIENT) : rpc(atomic_ticket_checkin) refusée
    ok 17 - anon : rpc(atomic_partner_remove_controller) refusée
    ok 18 - authenticated (compte CLIENT) : rpc(atomic_partner_remove_controller) refusée
    not ok 19 - anon : rpc(generate_referral_code) refusée
        → anon rpc(generate_referral_code) : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    not ok 20 - authenticated (compte CLIENT) : rpc(generate_referral_code) refusée
        → authenticated rpc(generate_referral_code) : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
not ok 1 - R3 — RPC métier non appelables par anon / authenticated
        → 14 subtests failed
    ok 1 - anon et authenticated : rpc(is_admin) acceptée
    ok 2 - anon et authenticated : rpc(is_superadmin) acceptée
    ok 3 - anon et authenticated : rpc(is_controller) acceptée
    ok 4 - anon et authenticated : rpc(has_role) acceptée
    ok 5 - anon et authenticated : rpc(is_partner_owner) acceptée
    ok 6 - anon et authenticated : rpc(auth_user_role) acceptée
ok 2 - R3 — aides RLS toujours appelables (sinon les politiques échouent)
# pass 12
# fail 14
```

Run 9 (après correctif) :

```text
    ok 1 - anon : rpc(validate_and_check_in_ticket) refusée
    ok 2 - authenticated (compte CLIENT) : rpc(validate_and_check_in_ticket) refusée
    ok 3 - anon : rpc(calculate_referral_commissions) refusée
    ok 4 - authenticated (compte CLIENT) : rpc(calculate_referral_commissions) refusée
    ok 5 - anon : rpc(activate_partner_trial) refusée
    ok 6 - authenticated (compte CLIENT) : rpc(activate_partner_trial) refusée
    ok 7 - anon : rpc(has_admin_permission) refusée
    ok 8 - authenticated (compte CLIENT) : rpc(has_admin_permission) refusée
    ok 9 - anon : rpc(create_hall_reservation_atomic) refusée
    ok 10 - authenticated (compte CLIENT) : rpc(create_hall_reservation_atomic) refusée
    ok 11 - anon : rpc(create_table_reservation_atomic) refusée
    ok 12 - authenticated (compte CLIENT) : rpc(create_table_reservation_atomic) refusée
    ok 13 - anon : rpc(request_withdrawal) refusée
    ok 14 - authenticated (compte CLIENT) : rpc(request_withdrawal) refusée
    ok 15 - anon : rpc(atomic_ticket_checkin) refusée
    ok 16 - authenticated (compte CLIENT) : rpc(atomic_ticket_checkin) refusée
    ok 17 - anon : rpc(atomic_partner_remove_controller) refusée
    ok 18 - authenticated (compte CLIENT) : rpc(atomic_partner_remove_controller) refusée
    ok 19 - anon : rpc(generate_referral_code) refusée
    ok 20 - authenticated (compte CLIENT) : rpc(generate_referral_code) refusée
ok 1 - R3 — RPC métier non appelables par anon / authenticated
    ok 1 - anon et authenticated : rpc(is_admin) acceptée
    ok 2 - anon et authenticated : rpc(is_superadmin) acceptée
    ok 3 - anon et authenticated : rpc(is_controller) acceptée
    ok 4 - anon et authenticated : rpc(has_role) acceptée
    ok 5 - anon et authenticated : rpc(is_partner_owner) acceptée
    ok 6 - anon et authenticated : rpc(auth_user_role) acceptée
ok 2 - R3 — aides RLS toujours appelables (sinon les politiques échouent)
# pass 26
# fail 0
```

**schema/fonctions-privileges**


Run 8 (avant correctif) :

```text
    not ok 1 - aucune fonction hors liste blanche n'est exécutable par anon ou authenticated
        → fonctions exécutables par les rôles API hors liste blanche : activate_partner_trial(p_partner_id uuid) [groupe b] anon=oui authenticated=oui audit_log_changes() [groupe c] anon=oui authenticated=oui
    not ok 2 - aucune fonction SECURITY DEFINER n'est exécutable par anon sans être sur la liste blanche
        → SECURITY DEFINER exécutables par anon : activate_partner_trial(p_partner_id uuid) audit_log_changes()
    not ok 3 - groupe a : présentes, exécutables par anon et authenticated, en lecture seule, search_path fixé
        → is_admin : search_path non fixé
    not ok 4 - toute fonction SECURITY DEFINER du projet a un search_path fixé
        → SECURITY DEFINER sans search_path : activate_partner_trial(p_partner_id uuid) atomic_partner_remove_controller(p_partner_id uuid, p_controller_id uuid)
    ok 5 - groupe b : toujours exécutables par service_role (parcours serveur)
    not ok 6 - validate_and_check_in_ticket est supprimée (inutilisée, composte sans vérifier l'appelant)
        → Expected values to be strictly equal: true !== false
    not ok 7 - privilèges par défaut : une nouvelle fonction de public n'est exécutable ni par anon ni par authenticated
        → anon peut exécuter une nouvelle fonction : privilèges par défaut non révoqués true !== false
not ok 1 - Fonctions du schéma public : inventaire et privilèges EXECUTE
        → 6 subtests failed
# pass 1
# fail 6
```

Run 9 (après correctif) :

```text
    ok 1 - aucune fonction hors liste blanche n'est exécutable par anon ou authenticated
    ok 2 - aucune fonction SECURITY DEFINER n'est exécutable par anon sans être sur la liste blanche
    ok 3 - groupe a : présentes, exécutables par anon et authenticated, en lecture seule, search_path fixé
    ok 4 - toute fonction SECURITY DEFINER du projet a un search_path fixé
    ok 5 - groupe b : toujours exécutables par service_role (parcours serveur)
    ok 6 - validate_and_check_in_ticket est supprimée (inutilisée, composte sans vérifier l'appelant)
    ok 7 - privilèges par défaut : une nouvelle fonction de public n'est exécutable ni par anon ni par authenticated
ok 1 - Fonctions du schéma public : inventaire et privilèges EXECUTE
# pass 7
# fail 0
```

### 1A.4 — Écritures directes par l'API REST (R4, R6, R5 en partie)

**Grep de dépendance.** Écritures sur `tickets`, `payments`, `audit_logs` :

```text
$ grep -rn "from('audit_logs')" app lib components hooks
app/api/admin/partners/[id]/status/route.ts:107:        await supabase.from('audit_logs').insert({
lib/admin/admin-auth.ts:127:            await supabase.from('audit_logs').insert({
lib/admin/admin.service.ts:234:            await supabase.from('audit_logs').insert({
lib/events/event-cancellation.service.ts:349:                await supabase.from('audit_logs').insert({
lib/events/event.service.ts:351:            await supabase.from('audit_logs').insert({
lib/events/event.service.ts:563:            await supabase.from('audit_logs').insert({
lib/events/event.service.ts:652:            await supabase.from('audit_logs').insert({
lib/payments/payment.service.ts:692:                        await supabase.from('audit_logs').insert({
(+ lectures admin : app/api/admin/audit/route.ts, app/api/admin/metrics/route.ts)

client utilisé par ces fichiers :
app/api/admin/partners/[id]/status/route.ts : 2 service_role, 0 anon
lib/admin/admin-auth.ts : 2 service_role, 1 anon     ← la clé anon n'y sert qu'à lire la session ; l'insertion passe par le service_role
lib/events/event-cancellation.service.ts : 4 service_role, 0 anon
lib/events/event.service.ts : 15 service_role, 0 anon
lib/payments/payment.service.ts : 6 service_role, 0 anon

accès des clients navigateur aux tables visées :
app/login/page.tsx:189:            supabase.from('users').select('role, status').eq('id', userId).maybeSingle(),
app/login/page.tsx:190:            supabase.from('user_roles').select('role').eq('user_id', userId),
app/register/page.tsx:162:                    .from('users')
components/providers/AuthProvider.tsx:87:                .from('users')
components/providers/AuthProvider.tsx:111:                        .from('partners')
```

Aucune écriture sur `tickets` ni `payments` depuis un client navigateur ; les abonnements Realtime à `tickets` et `payments` sont des lectures. Le trigger d'audit `audit_log_changes` est SECURITY DEFINER : il écrit comme propriétaire, sans dépendre des privilèges de l'appelant.

**Correctif.** Suppression de `tickets_insert_auth`, `tickets_update_controller`, `payments_insert_auth`, `audit_logs_insert_system` ; `REVOKE INSERT, UPDATE, DELETE ON audit_logs FROM anon, authenticated`.

**security/r4-ecritures-directes**


Run 8 (avant correctif) :

```text
    not ok 1 - CLIENT : insertion d'un billet VALIDE pour soi-même → refusée
        → INSERT tickets (billet forgé) : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    not ok 2 - CLIENT : insertion d'un paiement SUCCESS → refusée
        → INSERT payments (paiement forgé) : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    not ok 3 - CLIENT : insertion dans audit_logs → refusée
        → INSERT audit_logs (entrée forgée) : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    not ok 4 - CONTROLEUR : modification directe d'un billet par l'API → aucune ligne modifiée
        → UPDATE tickets par un contrôleur : 1 ligne(s) modifiée(s), attendu 0 + actual - expected
not ok 1 - R4 — écritures directes refusées
        → 4 subtests failed
# pass 0
# fail 4
```

Run 9 (après correctif) :

```text
    ok 1 - CLIENT : insertion d'un billet VALIDE pour soi-même → refusée
    ok 2 - CLIENT : insertion d'un paiement SUCCESS → refusée
    ok 3 - CLIENT : insertion dans audit_logs → refusée
    ok 4 - CONTROLEUR : modification directe d'un billet par l'API → aucune ligne modifiée
ok 1 - R4 — écritures directes refusées
# pass 4
# fail 0
```

**parcours/achat-serveur**


Run 8 (avant correctif) :

```text
ok 1 - checkout → paiement PENDING → notification SUCCESS → billet VALIDE émis par le serveur
# pass 1
# fail 0
```

Run 9 (après correctif) :

```text
ok 1 - checkout → paiement PENDING → notification SUCCESS → billet VALIDE émis par le serveur
# pass 1
# fail 0
```

### 1A.5 — Lectures exposées à anon

**Grep de dépendance.**

```text
lectures de users par un client navigateur : uniquement la ligne de l'utilisateur connecté
  (app/login/page.tsx:189, app/register/page.tsx:162, components/providers/AuthProvider.tsx:87) ;
nom de l'organisateur sur les pages publiques : servi par /api/events et /api/events/[id] (service_role,
  partners.commercial_name / company_name), aucune lecture de users d'autrui.

$ grep -rn "regisseur_pin" app lib components hooks tests
lib/shifts/shift.service.ts:106:                    regisseur_pin_hash: hash,
lib/shifts/shift.service.ts:107:                    regisseur_pin_updated_at: now,
lib/shifts/shift.service.ts:155:                    .select('regisseur_pin_hash')
(les autres occurrences sont le champ regisseur_pin des requêtes d'ouverture / clôture de caisse, sans rapport avec la colonne)
```

**Correctif.** `users_select_policy` sans la branche « propriétaire d'un partenaire validé ». Hash du PIN déplacé dans `event_regisseur_pins` (RLS, aucun privilège pour anon et authenticated, données recopiées, colonnes supprimées d'`events`). `ShiftService` lit et écrit la nouvelle table sans repli mémoire, et génère le PIN avec `crypto.randomInt`. La branche `is_controller()` de `users_select_policy` relève du lot 1B.

**security/r5-lectures-anon**


Run 8 (avant correctif) :

```text
    not ok 1 - anon : aucune ligne de users lisible (propriétaires de partenaires compris)
        → anon lit 5 profil(s) : partner-a@test.eventvillage.local, partner-b@test.eventvillage.local, partner.m9.fin_1793451780905_9118@eventvillage.sn, partner.m9.cycle_1793451781076_7689@eventvillage.sn, partner.m9.cancel_17934
    not ok 2 - anon : le hash du PIN régisseur n'est pas lisible sur events
        → anon SELECT events.regisseur_pin_hash : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    not ok 3 - authenticated (compte CLIENT) : le hash du PIN régisseur n'est pas lisible
        → authenticated SELECT events.regisseur_pin_hash : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    ok 4 - anon et authenticated : aucune table de PIN régisseur lisible
    ok 5 - régression : la lecture publique des événements publiés fonctionne toujours
not ok 1 - R5 — aucune donnée personnelle ni secret lisible par anon
        → 3 subtests failed
# pass 2
# fail 3
```

Run 9 (après correctif) :

```text
    ok 1 - anon : aucune ligne de users lisible (propriétaires de partenaires compris)
    ok 2 - anon : le hash du PIN régisseur n'est pas lisible sur events
    ok 3 - authenticated (compte CLIENT) : le hash du PIN régisseur n'est pas lisible
    ok 4 - anon et authenticated : aucune table de PIN régisseur lisible
    ok 5 - régression : la lecture publique des événements publiés fonctionne toujours
ok 1 - R5 — aucune donnée personnelle ni secret lisible par anon
# pass 5
# fail 0
```

**parcours/pin-regisseur**


Run 8 (avant correctif) :

```text
ok 1 - PIN régisseur : génération, vérification du bon PIN, refus d'un PIN erroné
ok 2 - PIN régisseur : un partenaire non propriétaire ne peut pas générer le PIN
# pass 2
# fail 0
```

Run 9 (après correctif) :

```text
ok 1 - PIN régisseur : génération, vérification du bon PIN, refus d'un PIN erroné
ok 2 - PIN régisseur : un partenaire non propriétaire ne peut pas générer le PIN
# pass 2
# fail 0
```

### 1A.6 — Garde-fous permanents

- `tests/schema/rls-toutes-tables.test.ts` : toutes les tables de `public` ont la RLS (37 tables au run 9, dont `event_regisseur_pins` ; 36 au run 8).
- `tests/schema/fonctions-privileges.test.ts` : aucune fonction hors liste blanche n'est exécutable par anon ou authenticated ; aucune SECURITY DEFINER exécutable par anon hors liste blanche ; toute SECURITY DEFINER a un `search_path` ; une nouvelle fonction n'est exécutable ni par anon ni par authenticated.

**schema/rls-toutes-tables**


Run 8 (avant correctif) :

```text
not ok 1 - toutes les tables du schéma public ont la RLS activée
        → tables sans RLS : otp_codes + actual - expected
# pass 0
# fail 1
```

Run 9 (après correctif) :

```text
ok 1 - toutes les tables du schéma public ont la RLS activée
# pass 1
# fail 0
```

### 1A.7 — Scripts pour le projet de test

`tests/schema/hotfix-scripts.test.ts` exécute les trois scripts SQL sur la base locale migrée : 01 en lecture seule, 02 deux fois de suite (idempotence), 03 sans aucun ÉCHEC. `tests/schema/hotfix-identique.test.ts` vérifie que 02 est exactement `BEGIN` + la migration + `COMMIT`. Ces tests ont trouvé deux défauts dans mes propres scripts, corrigés dans ce lot.

1. **03 ne s'exécutait pas** (run 10). Erreur : `operator is not unique: text || "char"` sur la concaténation de `provolatile`. Corrigé par un cast en texte (`0ff3529`), vert au run 11.
2. **La section A de 01 classait mal les comptes légitimes.** Au run 11, la détection sur la base locale comptait 3 ALERTE en section A. La section joignait `user_roles` sur le champ `role` des métadonnées. Or le trigger `sync_user_roles_to_jwt` réécrit ce champ avec le premier rôle détenu par ordre alphabétique : un compte CLIENT + SUPERADMIN porte `role = CLIENT`. Un SUPERADMIN attribué par le bootstrap sortait donc en ALERTE malgré sa trace d'audit, et un CONTROLEUR créé par l'API admin n'apparaissait pas du tout.

**Test rouge.** Nouveau test sur quatre comptes synthétiques, créés dans une transaction annulée. Une mise à jour des métadonnées y reproduit la réécriture que fait GoTrue après les triggers d'inscription. Run 12, commit `dd5fa41`, 01 d'origine :

```text
Section A sur les comptes synthétiques : [
 "attempt (rôle non exposé) INFO",
 "bootstrap (rôle non exposé) ALERTE",
 "forged (rôle non exposé) ALERTE"
]
    not ok 3 - 01-detection.sql section A : gravité par rôle réclamé, selon user_roles et la trace serveur
      error: |-
        Expected values to be strictly deep-equal:
        + actual - expected

          [
        +   'attempt (rôle non exposé) INFO',
        +   'bootstrap (rôle non exposé) ALERTE',
        +   'forged (rôle non exposé) ALERTE'
        -   'adminCreated CONTROLEUR A_VERIFIER',
        -   'attempt SUPERADMIN INFO',
        -   'bootstrap SUPERADMIN A_VERIFIER',
        -   'forged ADMIN ALERTE'
          ]

# pass 3
# fail 1
```

**Correctif** (`b6e542e`). Une ligne par compte et par rôle élevé réclamé, lu dans le champ `role` ou dans le tableau `roles`. Gravité selon `user_roles` et la trace de la route serveur qui attribue ce rôle. Pour CONTROLEUR, une entrée d'audit `CREATE_USER` ou `CONTROLLER_ACCOUNT_ACTIVATED` compte aussi comme trace.

**Test vert.** Run 13, commit `b6e542e` :

```text
Section A sur les comptes synthétiques : [
 "adminCreated CONTROLEUR A_VERIFIER",
 "attempt SUPERADMIN INFO",
 "bootstrap SUPERADMIN A_VERIFIER",
 "forged ADMIN ALERTE"
]
    ok 3 - 01-detection.sql section A : gravité par rôle réclamé, selon user_roles et la trace serveur
# pass 4
# fail 0
```

**Sortie de 01 sur la base locale de test** (run 13, comptes du seed et des suites précédentes) :

```text
Détection sur la base locale de test : {
 "A_metadata_role_eleve [A_VERIFIER]": 7,
 "A_metadata_role_eleve [ALERTE]": 2,
 "C_roles_admin_detenus [A_VERIFIER]": 3,
 "D_billet_sans_paiement [ALERTE]": 1,
 "H_inventaire_comptes [INFO]": 19,
 "I_otp_codes_exposes [INFO]": 1
}
Section A sur les comptes synthétiques : [
 "adminCreated CONTROLEUR A_VERIFIER",
 "attempt SUPERADMIN INFO",
 "bootstrap SUPERADMIN A_VERIFIER",
 "forged ADMIN ALERTE"
]
```

Le journal ne donne que des comptages. Leur lecture ci-dessous est déduite du seed (`tests/seed/seed-test.ts`) et des suites exécutées avant celle-ci.

- **A, 2 ALERTE.** Ce sont les comptes ADMIN et SUPERADMIN du seed. Le seed leur attribue le rôle directement dans `user_roles`, sans passer par une route serveur, donc sans trace d'audit. C'est exactement le profil que la section doit signaler.
- **A, 7 A_VERIFIER.** Ce sont les deux partenaires et le contrôleur du seed, puis le partenaire inscrit, le contrôleur créé par l'API admin et le contrôleur invité de `parcours/attribution-roles`, et enfin le SUPERADMIN de `parcours/bootstrap-superadmin`.
- **C, 3 A_VERIFIER.** Les détenteurs d'ADMIN ou de SUPERADMIN : les deux comptes du seed et celui du bootstrap.
- **D, 1 ALERTE.** Le billet de référence `TCK-FIXTURE-CLIENT-A-1`, que le seed insère sans commande ni paiement.
- Les comptes d'attaque des suites `tests/security` n'apparaissent pas, car ces suites passent après celle-ci. Les comptes synthétiques du test de la section A sont annulés avec leur transaction.

### 1A.8 — Scan de secrets

Voir la section 5 et l'encadré en tête du rapport.

---

## 3. Inventaire des fonctions (catalogue de la base locale migrée)

Produit par `tests/schema/fonctions-privileges.test.ts` (`pg_proc`, `has_function_privilege`). Les 188 fonctions appartenant à des extensions installées dans `public` ne sont pas modifiées et ne figurent pas ici.

**Avant correctif (run 8) :**

INVENTAIRE — 24 fonction(s) du projet dans public (+ 188 fonction(s) d'extensions)

| Groupe | Fonction | SECURITY DEFINER | Volatilité | search_path | EXECUTE anon | EXECUTE authenticated | EXECUTE service_role |
|---|---|---|---|---|---|---|---|
| a | auth_user_role() | oui | STABLE | — | oui | oui | oui |
| a | has_role(p_role user_role) | oui | STABLE | — | oui | oui | oui |
| a | is_admin() | oui | STABLE | — | oui | oui | oui |
| a | is_controller() | oui | STABLE | — | oui | oui | oui |
| a | is_partner_owner(p_partner_id uuid) | oui | STABLE | — | oui | oui | oui |
| a | is_superadmin() | oui | STABLE | — | oui | oui | oui |
| b | activate_partner_trial(p_partner_id uuid) | oui | VOLATILE | — | oui | oui | oui |
| b | atomic_partner_remove_controller(p_partner_id uuid, p_controller_id uuid) | oui | VOLATILE | — | non | non | oui |
| b | atomic_ticket_checkin(p_ticket_id uuid, p_controller_id uuid) | oui | VOLATILE | — | non | non | oui |
| b | calculate_referral_commissions(p_payment_id uuid) | oui | VOLATILE | — | oui | oui | oui |
| b | create_hall_reservation_atomic(p_hall_id uuid, p_client_id uuid, p_start_date date, p_end_date date, p_start_time time without time zone, p_end_time time without time zone, p_notes text, p_moratorium_date date) | oui | VOLATILE | — | oui | oui | oui |
| b | create_table_reservation_atomic(p_table_id uuid, p_client_id uuid, p_reservation_date date, p_reservation_time time without time zone, p_guest_count integer, p_notes text) | oui | VOLATILE | — | oui | oui | oui |
| b | generate_referral_code(p_user_id uuid, p_phone text) | non | VOLATILE | search_path=public, extensions | oui | oui | oui |
| b | has_admin_permission(p_user_id uuid, p_permission text) | oui | VOLATILE | — | oui | oui | oui |
| b | request_withdrawal(p_user_id uuid, p_gross_amount numeric, p_fee_rate numeric, p_fee_amount numeric, p_net_amount numeric, p_payment_details jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | validate_and_check_in_ticket(p_qr_code text, p_controller_id uuid) | oui | VOLATILE | — | oui | oui | oui |
| c | audit_log_changes() | oui | VOLATILE | search_path=public, auth, extensions | oui | oui | oui |
| c | check_hall_availability() | non | VOLATILE | — | oui | oui | oui |
| c | check_no_circular_referral() | non | VOLATILE | search_path=public, extensions | oui | oui | oui |
| c | handle_new_user() | oui | VOLATILE | search_path=public, auth, extensions | oui | oui | oui |
| c | handle_updated_at() | non | VOLATILE | search_path=public, extensions | oui | oui | oui |
| c | set_referral_code_on_insert() | non | VOLATILE | search_path=public, extensions | oui | oui | oui |
| c | sync_user_roles_to_jwt() | oui | VOLATILE | search_path=public, auth, extensions | oui | oui | oui |
| c | trg_fn_payment_success_commissions() | oui | VOLATILE | — | oui | oui | oui |

**Après correctif (run 9) :**

INVENTAIRE — 23 fonction(s) du projet dans public (+ 188 fonction(s) d'extensions)

| Groupe | Fonction | SECURITY DEFINER | Volatilité | search_path | EXECUTE anon | EXECUTE authenticated | EXECUTE service_role |
|---|---|---|---|---|---|---|---|
| a | auth_user_role() | oui | STABLE | search_path=public | oui | oui | oui |
| a | has_role(p_role user_role) | oui | STABLE | search_path=public | oui | oui | oui |
| a | is_admin() | oui | STABLE | search_path=public | oui | oui | oui |
| a | is_controller() | oui | STABLE | search_path=public | oui | oui | oui |
| a | is_partner_owner(p_partner_id uuid) | oui | STABLE | search_path=public | oui | oui | oui |
| a | is_superadmin() | oui | STABLE | search_path=public | oui | oui | oui |
| b | activate_partner_trial(p_partner_id uuid) | oui | VOLATILE | search_path=public, extensions | non | non | oui |
| b | atomic_partner_remove_controller(p_partner_id uuid, p_controller_id uuid) | oui | VOLATILE | search_path=public, extensions | non | non | oui |
| b | atomic_ticket_checkin(p_ticket_id uuid, p_controller_id uuid) | oui | VOLATILE | search_path=public, extensions | non | non | oui |
| b | calculate_referral_commissions(p_payment_id uuid) | oui | VOLATILE | search_path=public, extensions | non | non | oui |
| b | create_hall_reservation_atomic(p_hall_id uuid, p_client_id uuid, p_start_date date, p_end_date date, p_start_time time without time zone, p_end_time time without time zone, p_notes text, p_moratorium_date date) | oui | VOLATILE | search_path=public, extensions | non | non | oui |
| b | create_table_reservation_atomic(p_table_id uuid, p_client_id uuid, p_reservation_date date, p_reservation_time time without time zone, p_guest_count integer, p_notes text) | oui | VOLATILE | search_path=public, extensions | non | non | oui |
| b | generate_referral_code(p_user_id uuid, p_phone text) | non | VOLATILE | search_path=public, extensions | non | non | oui |
| b | has_admin_permission(p_user_id uuid, p_permission text) | oui | VOLATILE | search_path=public, extensions | non | non | oui |
| b | request_withdrawal(p_user_id uuid, p_gross_amount numeric, p_fee_rate numeric, p_fee_amount numeric, p_net_amount numeric, p_payment_details jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| c | audit_log_changes() | oui | VOLATILE | search_path=public, auth, extensions | non | non | oui |
| c | check_hall_availability() | non | VOLATILE | — | non | non | oui |
| c | check_no_circular_referral() | non | VOLATILE | search_path=public, extensions | non | non | oui |
| c | handle_new_user() | oui | VOLATILE | search_path=public | non | non | oui |
| c | handle_updated_at() | non | VOLATILE | search_path=public, extensions | non | non | oui |
| c | set_referral_code_on_insert() | non | VOLATILE | search_path=public, extensions | non | non | oui |
| c | sync_user_roles_to_jwt() | oui | VOLATILE | search_path=public, auth, extensions | non | non | oui |
| c | trg_fn_payment_success_commissions() | oui | VOLATILE | search_path=public, extensions | non | non | oui |

Lecture : groupe a = aides RLS (liste blanche), b = RPC métier, c = fonctions de triggers.

---

## 4. Fichiers de hotfix (contenu intégral)

Ordre d'exécution sur le projet de **test**, dans l'éditeur SQL : `01` (exporter le résultat) → `02` → `03` (tout doit être OK) → `04`. Les trois scripts SQL ont été exécutés sur la base locale migrée par `tests/schema/hotfix-scripts.test.ts` : 01 en lecture seule, 02 deux fois de suite (idempotence), 03 sans aucun ÉCHEC ; la section A de 01 est aussi vérifiée sur quatre comptes synthétiques (section 2, 1A.7). Avant d'appliquer 02, relire la section G de 01 : 02 retire `EXECUTE` à anon et authenticated sur **toute** fonction de `public` hors liste blanche, y compris des fonctions créées à la main sur le projet de test.

### 01-detection.sql

```sql
-- ============================================================================
-- EVENT VILLAGE — LOT 1A — 01 : DÉTECTION (LECTURE SEULE) — À EXÉCUTER AVANT 02-hotfix.sql
-- ============================================================================
-- Projet visé : le projet Supabase de TEST (le dépôt a été public).
-- Objet : savoir si quelqu'un a exploité les failles pendant l'exposition du dépôt.
--
-- Une seule instruction SELECT, sans écriture : l'éditeur SQL de Supabase n'affiche que le
-- résultat de la dernière instruction. Exportez le résultat (CSV) avant d'appliquer 02.
-- Les codes OTP ne sont jamais affichés.
--
-- Colonnes : controle | gravite (ALERTE / A_VERIFIER / INFO) | objet_id | cree_le | details
-- Lecture des sections :
--   A  comptes dont les métadonnées d'inscription réclament un rôle élevé
--   B  comptes dont les métadonnées contiennent le téléphone de bootstrap SUPERADMIN
--   C  rôles ADMIN / SUPERADMIN effectivement détenus (user_roles)
--   D  billets sans commande ni paiement rattaché (billet forgé ?)
--   E  paiements SUCCESS sans transaction SamirPay ou avec un identifiant non produit par le serveur
--   F  entrées d'audit suspectes (action inconnue du code, ou rôle déclaré non détenu)
--   G  fonctions du schéma public absentes des migrations du dépôt, ou exécutables par anon
--   H  inventaire de tous les comptes (repérer un compte étranger)
--   I  table otp_codes : volume exposé (sans les codes)
-- Complément hors SQL : Dashboard Supabase > Logs > API, filtrer les requêtes vers
-- /rest/v1/otp_codes, /rest/v1/rpc/ (exec_sql, validate_and_check_in_ticket,
-- create_hall_reservation_atomic, create_table_reservation_atomic, activate_partner_trial) et les
-- POST sur /rest/v1/tickets, /rest/v1/payments, /rest/v1/audit_logs.
-- ============================================================================

WITH
known_actions(action) AS (
    VALUES
        ('INSERT'), ('UPDATE'), ('DELETE'), ('FIRST_ACTIVATION'),
        ('ANONYMIZE_USER'), ('CASH_COLLECTION'), ('CATEGORY_CREATED'), ('CATEGORY_STOCK_UPDATED'),
        ('CONTROLLER_ACCOUNT_ACTIVATED'), ('CONTROLLER_ASSIGNMENTS_UPDATED'), ('CONTROLLER_DELETED'),
        ('CONTROLLER_INVITED'), ('CONTROLLER_REMOVED'), ('CONTROLLER_REMOVED_ALL'), ('CREATE_USER'),
        ('EVENT_CANCELLED_INSUFFICIENT_FLOAT'), ('EVENT_LIVE_UPDATED'), ('EVENT_UPDATED'),
        ('PARTNER_REGISTRATION'), ('PASSWORD_CHANGED'), ('PAYMENT_OVERBOOKED_AUTO_REFUNDED'),
        ('PAYMENT_OVERBOOKED_REFUND_FAILED'), ('SEND_COMMUNICATION'), ('SENSITIVE_ACTION_VERIFIED'),
        ('STATUS_CHANGE'), ('SUPERADMIN_BOOTSTRAP'), ('TICKET_SCAN'), ('TRANSFER_CLAIMED_RECIPIENT'),
        ('TRANSFER_CLAIMED_SENDER'), ('UNAUTHORIZED_ACCESS_ATTEMPT'), ('UPDATE_PERMISSIONS'),
        ('UPDATE_PRICING'), ('UPDATE_SERVICE_STATUS'), ('UPDATE_USER')
),
repo_functions(name) AS (
    VALUES
        ('activate_partner_trial'), ('atomic_partner_remove_controller'), ('atomic_ticket_checkin'),
        ('audit_log_changes'), ('auth_user_role'), ('calculate_referral_commissions'),
        ('check_hall_availability'), ('check_no_circular_referral'), ('create_hall_reservation_atomic'),
        ('create_table_reservation_atomic'), ('generate_referral_code'), ('handle_new_user'),
        ('handle_updated_at'), ('has_admin_permission'), ('has_role'), ('is_admin'), ('is_controller'),
        ('is_partner_owner'), ('is_superadmin'), ('request_withdrawal'), ('set_referral_code_on_insert'),
        ('sync_user_roles_to_jwt'), ('trg_fn_payment_success_commissions'), ('validate_and_check_in_ticket')
),
rls_helpers(name) AS (
    VALUES ('is_admin'), ('is_superadmin'), ('is_controller'), ('has_role'), ('is_partner_owner'), ('auth_user_role')
)

-- A — rôle élevé réclamé dans les métadonnées (champ « role » ou tableau « roles »).
--     Une métadonnée ne prouve pas à elle seule une inscription malveillante :
--       - avant le lot 1A, les parcours légitimes passaient AUSSI le rôle en métadonnée
--         (inscription partenaire, création par un admin) ;
--       - le trigger sync_user_roles_to_jwt recopie les rôles détenus dans « roles », et le
--         premier par ordre alphabétique dans « role » (CLIENT pour un compte CLIENT + SUPERADMIN).
--     Chaque rôle élevé réclamé est donc évalué séparément (une ligne par compte et par rôle),
--     contre user_roles et contre la trace laissée par la route serveur qui l'attribue :
--       PARTENAIRE → fiche partners ;
--       CONTROLEUR → affectation event_controllers, ou audit CREATE_USER / CONTROLLER_ACCOUNT_ACTIVATED ;
--       ADMIN / SUPERADMIN → audit CREATE_USER ou SUPERADMIN_BOOTSTRAP.
--     ALERTE = rôle réclamé, détenu, SANS trace serveur ; A_VERIFIER = détenu avec trace ;
--     INFO = réclamé mais non détenu (tentative sans effet, ou compte corrigé).
SELECT 'A_metadata_role_eleve' AS controle,
       CASE
           WHEN NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = c.user_id AND ur.role::text = c.role)
             THEN 'INFO'
           WHEN (c.role = 'PARTENAIRE' AND EXISTS (SELECT 1 FROM public.partners p WHERE p.user_id = c.user_id))
             OR (c.role = 'CONTROLEUR' AND (EXISTS (SELECT 1 FROM public.event_controllers ec WHERE ec.user_id = c.user_id)
                     OR EXISTS (SELECT 1 FROM public.audit_logs a WHERE a.object_id = c.user_id
                                  AND a.action IN ('CREATE_USER', 'CONTROLLER_ACCOUNT_ACTIVATED'))))
             OR (c.role IN ('ADMIN', 'SUPERADMIN') AND EXISTS (SELECT 1 FROM public.audit_logs a
                     WHERE a.object_id = c.user_id AND a.action IN ('CREATE_USER', 'SUPERADMIN_BOOTSTRAP')))
             THEN 'A_VERIFIER'
           ELSE 'ALERTE'
       END AS gravite,
       c.user_id::text AS objet_id,
       u.created_at AS cree_le,
       jsonb_build_object(
           'email', u.email, 'phone', u.phone,
           'role_reclame', c.role,
           'metadata_role', u.raw_user_meta_data->>'role',
           'metadata_roles', u.raw_user_meta_data->'roles',
           'roles_detenus', (SELECT jsonb_agg(ur.role::text ORDER BY ur.role::text) FROM public.user_roles ur WHERE ur.user_id = c.user_id),
           'derniere_connexion', u.last_sign_in_at,
           'confirmation_envoyee_le', u.confirmation_sent_at,
           'note', 'ALERTE = rôle réclamé, détenu, sans trace d''attribution serveur'
       ) AS details
  FROM (
        SELECT DISTINCT u0.id AS user_id, claimed.role
          FROM auth.users u0
         CROSS JOIN LATERAL (
                SELECT u0.raw_user_meta_data->>'role' AS role
                UNION
                SELECT jsonb_array_elements_text(
                           CASE WHEN jsonb_typeof(u0.raw_user_meta_data->'roles') = 'array'
                                THEN u0.raw_user_meta_data->'roles' ELSE '[]'::jsonb END)
               ) claimed
         WHERE claimed.role IN ('ADMIN', 'SUPERADMIN', 'PARTENAIRE', 'CONTROLEUR')
       ) c
  JOIN auth.users u ON u.id = c.user_id

UNION ALL
-- B — téléphone de bootstrap SUPERADMIN fourni en métadonnée (auth.users.phone vide)
SELECT 'B_metadata_telephone_bootstrap',
       'ALERTE',
       u.id::text,
       u.created_at,
       jsonb_build_object('email', u.email, 'auth_phone', u.phone, 'metadata_phone', u.raw_user_meta_data->>'phone',
                          'superadmin_effectif', EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'SUPERADMIN'))
  FROM auth.users u
 WHERE regexp_replace(COALESCE(u.raw_user_meta_data->>'phone', ''), '\D', '', 'g') IN
       ('773780756', '221773780756', '00221773780756', '770000000', '221770000000', '00221770000000')
   AND regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g') NOT IN
       ('773780756', '221773780756', '00221773780756', '770000000', '221770000000', '00221770000000')

UNION ALL
-- C — rôles ADMIN / SUPERADMIN effectivement détenus
SELECT 'C_roles_admin_detenus',
       'A_VERIFIER',
       ur.user_id::text,
       ur.created_at,
       jsonb_build_object('role', ur.role, 'email', u.email, 'phone', u.phone,
                          'compte_cree_le', u.created_at, 'derniere_connexion', u.last_sign_in_at,
                          'metadata_role', u.raw_user_meta_data->>'role')
  FROM public.user_roles ur
  LEFT JOIN auth.users u ON u.id = ur.user_id
 WHERE ur.role IN ('ADMIN', 'SUPERADMIN')

UNION ALL
-- D — billets sans commande ni paiement rattaché (ni par ticket_id, ni par paiement SUCCESS du même
--     client sur le même événement) ; les billets gratuits (prix 0) sont signalés en A_VERIFIER.
SELECT 'D_billet_sans_paiement',
       CASE WHEN t.price > 0 THEN 'ALERTE' ELSE 'A_VERIFIER' END,
       t.id::text,
       t.created_at,
       jsonb_build_object('ticket_number', t.ticket_number, 'statut', t.status, 'prix', t.price,
                          'evenement', e.title, 'porteur', pu.email, 'composte_le', t.checked_in_at)
  FROM public.tickets t
  LEFT JOIN public.events e ON e.id = t.event_id
  LEFT JOIN auth.users pu ON pu.id = t.user_id
 WHERE t.order_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.ticket_id = t.id)
   AND NOT EXISTS (
        SELECT 1 FROM public.payments p
         WHERE p.client_id = t.user_id AND p.status = 'SUCCESS'
           AND (p.metadata->>'event_id' = t.event_id::text OR p.metadata->>'eventId' = t.event_id::text)
   )

UNION ALL
-- E — paiements SUCCESS suspects
SELECT 'E_paiement_success_suspect',
       CASE WHEN p.transaction_id !~ '^TX-(EV|CASH|INV)-' THEN 'ALERTE' ELSE 'A_VERIFIER' END,
       p.id::text,
       p.created_at,
       jsonb_build_object('transaction_id', p.transaction_id, 'external_transaction_id', p.external_transaction_id,
                          'plateforme', p.is_platform_payment, 'montant', p.amount, 'cible', p.payment_target,
                          'client', cu.email, 'provider_status', p.provider_status,
                          'note', 'ALERTE = identifiant non produit par le serveur (insertion directe probable)')
  FROM public.payments p
  LEFT JOIN auth.users cu ON cu.id = p.client_id
 WHERE p.status = 'SUCCESS'
   AND (
        p.transaction_id !~ '^TX-(EV|CASH|INV)-'
        OR (p.is_platform_payment AND p.external_transaction_id IS NULL)
   )

UNION ALL
-- F — entrées d'audit suspectes
SELECT 'F_audit_suspect',
       'ALERTE',
       a.id::text,
       a.created_at,
       jsonb_build_object('action', a.action, 'user_role_declare', a.user_role, 'objet', a.object_type,
                          'auteur', au.email,
                          'action_inconnue_du_code', NOT EXISTS (SELECT 1 FROM known_actions k WHERE k.action = a.action),
                          'role_declare_non_detenu', a.user_role IN ('ADMIN', 'SUPERADMIN')
                              AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = a.user_id AND r.role::text = a.user_role))
  FROM public.audit_logs a
  LEFT JOIN auth.users au ON au.id = a.user_id
 WHERE NOT EXISTS (SELECT 1 FROM known_actions k WHERE k.action = a.action)
    OR (a.user_role IN ('ADMIN', 'SUPERADMIN')
        AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = a.user_id AND r.role::text = a.user_role))

UNION ALL
-- G — fonctions de public absentes des migrations, ou RPC exécutables par anon hors aides RLS
SELECT 'G_fonction_suspecte',
       CASE WHEN NOT EXISTS (SELECT 1 FROM repo_functions rf WHERE rf.name = p.proname) THEN 'ALERTE' ELSE 'A_VERIFIER' END,
       p.oid::regprocedure::text,
       NULL::timestamptz,
       jsonb_build_object('security_definer', p.prosecdef,
                          'execute_anon', has_function_privilege('anon', p.oid, 'EXECUTE'),
                          'execute_authenticated', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
                          'absente_des_migrations', NOT EXISTS (SELECT 1 FROM repo_functions rf WHERE rf.name = p.proname),
                          'proprietaire', pg_get_userbyid(p.proowner))
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.prokind = 'f'
   AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
   AND (
        NOT EXISTS (SELECT 1 FROM repo_functions rf WHERE rf.name = p.proname)
        OR (has_function_privilege('anon', p.oid, 'EXECUTE') AND NOT EXISTS (SELECT 1 FROM rls_helpers h WHERE h.name = p.proname))
   )

UNION ALL
-- H — inventaire de tous les comptes (repérer un compte étranger au projet)
SELECT 'H_inventaire_comptes',
       'INFO',
       u.id::text,
       u.created_at,
       jsonb_build_object('email', u.email, 'phone', u.phone,
                          'fournisseur', u.raw_app_meta_data->>'provider',
                          'email_confirme_le', u.email_confirmed_at,
                          'confirmation_envoyee_le', u.confirmation_sent_at,
                          'derniere_connexion', u.last_sign_in_at,
                          'roles', (SELECT jsonb_agg(r.role ORDER BY r.role) FROM public.user_roles r WHERE r.user_id = u.id),
                          'indice', CASE WHEN u.confirmation_sent_at IS NOT NULL THEN 'inscription publique probable'
                                         ELSE 'création serveur (API admin) probable' END)
  FROM auth.users u

UNION ALL
-- I — volume de codes OTP exposés (jamais les codes)
SELECT 'I_otp_codes_exposes',
       'INFO',
       NULL,
       MAX(o.created_at),
       jsonb_build_object('lignes', COUNT(*), 'non_verifiees', COUNT(*) FILTER (WHERE NOT o.verified),
                          'encore_valides', COUNT(*) FILTER (WHERE o.expires_at > now()), 'plus_ancienne', MIN(o.created_at))
  FROM public.otp_codes o

ORDER BY controle, cree_le DESC NULLS LAST;
```

### 02-hotfix.sql

```sql
-- ============================================================================
-- EVENT VILLAGE — LOT 1A — 02 : CORRECTIF (projet de test, éditeur SQL Supabase)
-- ============================================================================
-- Exécuter APRÈS 01-detection.sql (exporter son résultat), puis lancer 03-verification.sql.
-- Transactionnel : tout ou rien. Idempotent : peut être relancé.
-- Corps STRICTEMENT identique à supabase/migrations/20261031000002_lot1a_failles_sans_privilege.sql
-- (généré par scripts/build-hotfix-lot1a.mjs, contrôlé par tests/schema/hotfix-identique.test.ts).
-- Ne pas faire de « supabase db push » sur ce projet : son historique de migrations n'est pas aligné.
-- ============================================================================

BEGIN;
-- ============================================================================
-- EVENT VILLAGE — MIGRATION 20261031000002 : LOT 1A, FAILLES EXPLOITABLES SANS PRIVILÈGE
-- ============================================================================
-- Référence : docs/lot1a-rapport.md (constats R1 à R6 de docs/audit-evenementiel-cdc-v3.md).
-- Idempotente : peut être rejouée sans effet de bord. Le fichier
-- supabase/hotfix/2026-10-31-lot1a/02-hotfix.sql contient exactement ce corps entre BEGIN et COMMIT.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1A.1 — Inscription : plus aucune élévation de rôle (R1)
-- ----------------------------------------------------------------------------
-- Tout compte créé par GoTrue est CLIENT. Les métadonnées d'inscription (contrôlées par
-- l'utilisateur) ne fournissent plus ni rôle, ni téléphone, ni bootstrap SUPERADMIN.
-- Les rôles PARTENAIRE, CONTROLEUR, ADMIN et SUPERADMIN sont attribués par les routes
-- serveur (service_role) : /api/partner/register, /api/partner/team/invite,
-- /api/admin/users, scripts/bootstrap-superadmin.ts.
-- Téléphone : uniquement auth.users.phone, vide ramené à NULL (users.phone est UNIQUE).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_phone TEXT := NULLIF(TRIM(NEW.phone), '');
    v_email TEXT := NULLIF(TRIM(NEW.email), '');
BEGIN
    IF v_email IS NULL AND v_phone IS NOT NULL THEN
        v_email := REPLACE(v_phone, '+', '') || '@eventvillage.sn';
    END IF;

    INSERT INTO public.users (id, first_name, last_name, phone, email, role, status, referral_status)
    VALUES (
        NEW.id,
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''), 'Utilisateur'),
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), ''), 'Event Village'),
        v_phone,
        v_email,
        'CLIENT',
        'ACTIF',
        'STANDARD'
    )
    ON CONFLICT (id) DO UPDATE SET
        email      = EXCLUDED.email,
        updated_at = now();

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'CLIENT')
    ON CONFLICT (user_id, role) DO NOTHING;

    RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1A.2 — otp_codes (R2) : RLS activée, aucune politique, aucun privilège pour anon / authenticated
-- ----------------------------------------------------------------------------
-- Toutes les lectures et écritures applicatives passent par le service_role (routes
-- /api/auth/*, /api/controller/setup, /api/partner/*, lib/security/sensitive-action.service.ts).
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'otp_codes' LOOP
        EXECUTE format('DROP POLICY %I ON public.otp_codes', r.policyname);
    END LOOP;
END $$;

REVOKE ALL ON TABLE public.otp_codes FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.otp_codes TO service_role;

-- ----------------------------------------------------------------------------
-- 1A.3 — Fonctions du schéma public : droits EXECUTE minimaux (R3)
-- ----------------------------------------------------------------------------
-- Groupe a — aides utilisées par les politiques RLS : restent exécutables par anon ET
-- authenticated (les politiques sans clause TO s'évaluent aussi pour anon ; leur retirer
-- EXECUTE casserait toute lecture protégée). Lecture seule (STABLE), search_path fixé.
-- Groupe b — RPC métier : service_role uniquement.
-- Groupe c — fonctions de triggers : aucun EXECUTE pour les rôles API (le déclenchement
-- d'un trigger ne vérifie pas ce privilège).
-- Les fonctions appartenant à une extension ne sont pas modifiées.

-- Composte n'importe quel billet en se fiant à l'identifiant de contrôleur passé en paramètre ;
-- aucun appelant applicatif (grep : 0 occurrence hors migrations).
DROP FUNCTION IF EXISTS public.validate_and_check_in_ticket(text, uuid);

-- Fonctions d'exécution de SQL arbitraire : absentes des migrations, mais appelées sur le projet
-- de test (rpc/exec_sql). Supprimées si elles existent, quelle que soit leur signature.
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS sig
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname IN ('exec_sql', 'execute_sql', 'run_sql', 'exec')
           AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
    LOOP
        EXECUTE format('DROP FUNCTION %s', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    v_whitelist CONSTANT text[] := ARRAY['is_admin', 'is_superadmin', 'is_controller', 'has_role', 'is_partner_owner', 'auth_user_role'];
    r record;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS sig, p.proname, p.prosecdef, p.proconfig
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.prokind = 'f'
           AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
    LOOP
        IF r.proname = ANY (v_whitelist) THEN
            -- Groupe a
            EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', r.sig);
        ELSE
            -- Groupes b et c
            EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
            IF r.prosecdef AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(r.proconfig, ARRAY[]::text[])) c WHERE c LIKE 'search_path=%') THEN
                EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', r.sig);
            END IF;
        END IF;
    END LOOP;
END $$;

-- Fonctions futures : plus d'EXECUTE implicite. La forme globale retire le défaut PostgreSQL
-- (EXECUTE à PUBLIC) ; la forme par schéma retire les droits accordés par Supabase à anon et
-- authenticated. Une nouvelle aide RLS devra recevoir un GRANT explicite (et entrer dans la liste
-- blanche de tests/schema/fonctions-privileges.test.ts).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 1A.4 — Écritures directes par l'API REST (R4, R6, R5 en partie)
-- ----------------------------------------------------------------------------
-- Billets, paiements et journal d'audit ne s'écrivent que côté serveur (service_role) ou par
-- les triggers SECURITY DEFINER (audit_log_changes). Grep : aucune écriture sur ces tables
-- depuis un client navigateur ou anon (voir rapport).
DROP POLICY IF EXISTS "tickets_insert_auth" ON public.tickets;          -- billet VALIDE forgeable par tout compte
DROP POLICY IF EXISTS "tickets_update_controller" ON public.tickets;    -- tout contrôleur modifiait tout billet
DROP POLICY IF EXISTS "payments_insert_auth" ON public.payments;        -- paiement SUCCESS forgeable par tout compte
DROP POLICY IF EXISTS "audit_logs_insert_system" ON public.audit_logs;  -- WITH CHECK (TRUE) : journal falsifiable

REVOKE INSERT, UPDATE, DELETE ON TABLE public.audit_logs FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 1A.5 — Lectures exposées à anon
-- ----------------------------------------------------------------------------
-- a) users_select_policy : la branche « propriétaire d'un partenaire VALIDE » rendait lisibles
--    par anon les nom, email et téléphone de ces comptes. Les pages publiques obtiennent le nom
--    de l'organisateur côté serveur (partners.commercial_name via /api/events, service_role) ;
--    grep : aucune lecture de users d'autrui depuis un client navigateur.
--    La branche is_controller() relève du lot 1B (politiques contrôleur).
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT USING (
        id = auth.uid()
        OR is_admin()
        OR is_controller()
    );

-- b) Hash du PIN régisseur : déplacé de events (lisible par anon via events_read_public) vers une
--    table non exposée aux rôles API. Seul lib/shifts/shift.service.ts (service_role) y accède.
CREATE TABLE IF NOT EXISTS public.event_regisseur_pins (
    event_id   UUID PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
    pin_hash   TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.event_regisseur_pins IS 'Hash (HMAC-SHA256) du code PIN régisseur par événement. Accès service_role uniquement.';

ALTER TABLE public.event_regisseur_pins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.event_regisseur_pins FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.event_regisseur_pins TO service_role;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'regisseur_pin_hash'
    ) THEN
        EXECUTE $copy$
            INSERT INTO public.event_regisseur_pins (event_id, pin_hash, updated_at)
            SELECT id, regisseur_pin_hash, COALESCE(regisseur_pin_updated_at, now())
              FROM public.events
             WHERE regisseur_pin_hash IS NOT NULL
            ON CONFLICT (event_id) DO NOTHING
        $copy$;
    END IF;
END $$;

ALTER TABLE public.events DROP COLUMN IF EXISTS regisseur_pin_hash;
ALTER TABLE public.events DROP COLUMN IF EXISTS regisseur_pin_updated_at;

COMMIT;
```

### 03-verification.sql

```sql
-- ============================================================================
-- EVENT VILLAGE — LOT 1A — 03 : VÉRIFICATION (LECTURE SEULE) — À EXÉCUTER APRÈS 02-hotfix.sql
-- ============================================================================
-- Une ligne par point corrigé : point | statut (OK / ÉCHEC) | detail
-- Une seule instruction SELECT (l'éditeur SQL n'affiche que le dernier résultat).
-- ============================================================================

WITH
fns AS (
    SELECT p.oid, p.proname, p.prosecdef, p.provolatile, COALESCE(array_to_string(p.proconfig, ' '), '') AS config,
           p.prosrc,
           has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
           has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_exec
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prokind = 'f'
       AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
),
whitelist(name) AS (
    VALUES ('is_admin'), ('is_superadmin'), ('is_controller'), ('has_role'), ('is_partner_owner'), ('auth_user_role')
),
checks(point, ok, detail) AS (
    -- 1A.1
    SELECT '1A.1 handle_new_user ne lit plus le rôle ni le téléphone des métadonnées',
           NOT EXISTS (SELECT 1 FROM fns WHERE proname = 'handle_new_user' AND (prosrc ILIKE '%meta_data->>''role''%' OR prosrc ILIKE '%meta_data->>''phone''%' OR prosrc LIKE '%773780756%')),
           'corps de public.handle_new_user'
    UNION ALL
    SELECT '1A.1 handle_new_user : search_path fixé',
           EXISTS (SELECT 1 FROM fns WHERE proname = 'handle_new_user' AND config LIKE '%search_path=%'),
           (SELECT string_agg(config, ' / ') FROM fns WHERE proname = 'handle_new_user')
    UNION ALL
    SELECT '1A.1 handle_new_user : téléphone vide ramené à NULL',
           EXISTS (SELECT 1 FROM fns WHERE proname = 'handle_new_user' AND prosrc ILIKE '%NULLIF(TRIM(NEW.phone)%'),
           'NULLIF(TRIM(NEW.phone), '''')'
    -- 1A.2
    UNION ALL
    SELECT '1A.2 otp_codes : RLS activée',
           (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.otp_codes'::regclass),
           'pg_class.relrowsecurity'
    UNION ALL
    SELECT '1A.2 otp_codes : aucune politique',
           NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'otp_codes'),
           (SELECT COALESCE(string_agg(policyname, ', '), 'aucune') FROM pg_policies WHERE schemaname = 'public' AND tablename = 'otp_codes')
    UNION ALL
    SELECT '1A.2 otp_codes : aucun privilège pour anon ni authenticated',
           NOT (has_table_privilege('anon', 'public.otp_codes', 'SELECT') OR has_table_privilege('anon', 'public.otp_codes', 'INSERT')
                OR has_table_privilege('authenticated', 'public.otp_codes', 'SELECT') OR has_table_privilege('authenticated', 'public.otp_codes', 'INSERT')
                OR has_table_privilege('authenticated', 'public.otp_codes', 'UPDATE') OR has_table_privilege('authenticated', 'public.otp_codes', 'DELETE')),
           'has_table_privilege'
    -- 1A.3
    UNION ALL
    SELECT '1A.3 validate_and_check_in_ticket supprimée',
           NOT EXISTS (SELECT 1 FROM fns WHERE proname = 'validate_and_check_in_ticket'),
           'pg_proc'
    UNION ALL
    SELECT '1A.3 aucune fonction d''exécution de SQL arbitraire (exec_sql…)',
           NOT EXISTS (SELECT 1 FROM fns WHERE proname IN ('exec_sql', 'execute_sql', 'run_sql', 'exec')),
           (SELECT COALESCE(string_agg(oid::regprocedure::text, ', '), 'aucune') FROM fns WHERE proname IN ('exec_sql', 'execute_sql', 'run_sql', 'exec'))
    UNION ALL
    SELECT '1A.3 aucune fonction hors liste blanche exécutable par anon / authenticated',
           NOT EXISTS (SELECT 1 FROM fns WHERE (anon_exec OR auth_exec) AND proname NOT IN (SELECT name FROM whitelist)),
           (SELECT COALESCE(string_agg(oid::regprocedure::text, ', '), 'aucune') FROM fns WHERE (anon_exec OR auth_exec) AND proname NOT IN (SELECT name FROM whitelist))
    UNION ALL
    SELECT '1A.3 aides RLS exécutables par anon et authenticated, STABLE, search_path fixé',
           (SELECT COUNT(*) FROM fns WHERE proname IN (SELECT name FROM whitelist) AND anon_exec AND auth_exec AND provolatile IN ('s', 'i') AND config LIKE '%search_path=%')
             = (SELECT COUNT(*) FROM fns WHERE proname IN (SELECT name FROM whitelist))
           AND (SELECT COUNT(DISTINCT proname) FROM fns WHERE proname IN (SELECT name FROM whitelist)) = 6,
           (SELECT string_agg(proname || ':' || CASE WHEN anon_exec AND auth_exec THEN 'exec' ELSE 'NON-exec' END || ':' || provolatile::text, ', ') FROM fns WHERE proname IN (SELECT name FROM whitelist))
    UNION ALL
    SELECT '1A.3 RPC métier exécutables par service_role',
           NOT EXISTS (SELECT 1 FROM fns WHERE proname NOT IN (SELECT name FROM whitelist) AND NOT service_exec),
           (SELECT COALESCE(string_agg(oid::regprocedure::text, ', '), 'toutes') FROM fns WHERE proname NOT IN (SELECT name FROM whitelist) AND NOT service_exec)
    UNION ALL
    SELECT '1A.3 toute SECURITY DEFINER a un search_path',
           NOT EXISTS (SELECT 1 FROM fns WHERE prosecdef AND config NOT LIKE '%search_path=%'),
           (SELECT COALESCE(string_agg(oid::regprocedure::text, ', '), 'aucune manquante') FROM fns WHERE prosecdef AND config NOT LIKE '%search_path=%')
    UNION ALL
    SELECT '1A.3 privilèges par défaut : EXECUTE retiré à PUBLIC (global) et à anon / authenticated (public)',
           EXISTS (SELECT 1 FROM pg_default_acl d WHERE d.defaclrole = 'postgres'::regrole AND d.defaclnamespace = 0 AND d.defaclobjtype = 'f'
                     AND NOT EXISTS (SELECT 1 FROM aclexplode(d.defaclacl) x WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE'))
           AND NOT EXISTS (SELECT 1 FROM pg_default_acl d, aclexplode(d.defaclacl) x
                            WHERE d.defaclrole = 'postgres'::regrole AND d.defaclnamespace = 'public'::regnamespace AND d.defaclobjtype = 'f'
                              AND x.grantee IN ('anon'::regrole, 'authenticated'::regrole) AND x.privilege_type = 'EXECUTE'),
           'pg_default_acl'
    -- 1A.4
    UNION ALL
    SELECT '1A.4 politiques d''écriture directe supprimées',
           NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                        AND policyname IN ('tickets_insert_auth', 'tickets_update_controller', 'payments_insert_auth', 'audit_logs_insert_system')),
           (SELECT COALESCE(string_agg(policyname, ', '), 'aucune') FROM pg_policies WHERE schemaname = 'public'
              AND policyname IN ('tickets_insert_auth', 'tickets_update_controller', 'payments_insert_auth', 'audit_logs_insert_system'))
    UNION ALL
    SELECT '1A.4 audit_logs : ni INSERT, ni UPDATE, ni DELETE pour anon / authenticated',
           NOT (has_table_privilege('anon', 'public.audit_logs', 'INSERT') OR has_table_privilege('authenticated', 'public.audit_logs', 'INSERT')
                OR has_table_privilege('anon', 'public.audit_logs', 'UPDATE') OR has_table_privilege('authenticated', 'public.audit_logs', 'UPDATE')
                OR has_table_privilege('anon', 'public.audit_logs', 'DELETE') OR has_table_privilege('authenticated', 'public.audit_logs', 'DELETE')),
           'has_table_privilege'
    UNION ALL
    SELECT '1A.4 aucune politique INSERT / ALL restante sur tickets et payments pour les rôles API',
           NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('tickets', 'payments')
                        AND cmd IN ('INSERT', 'ALL') AND (roles @> ARRAY['public']::name[] OR roles && ARRAY['anon', 'authenticated']::name[])
                        AND COALESCE(with_check, qual, '') NOT ILIKE '%is_admin()%'),
           (SELECT COALESCE(string_agg(tablename || '.' || policyname || ' (' || cmd || ')', ', '), 'aucune') FROM pg_policies
             WHERE schemaname = 'public' AND tablename IN ('tickets', 'payments') AND cmd IN ('INSERT', 'ALL'))
    -- 1A.5
    UNION ALL
    SELECT '1A.5 users_select_policy sans branche « partenaire validé »',
           NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND cmd = 'SELECT' AND qual ILIKE '%partners%'),
           (SELECT string_agg(policyname || ': ' || qual, ' | ') FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND cmd = 'SELECT')
    UNION ALL
    SELECT '1A.5 events sans colonnes regisseur_pin_*',
           NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name LIKE 'regisseur_pin%'),
           'information_schema.columns'
    UNION ALL
    SELECT '1A.5 event_regisseur_pins : RLS activée, aucun privilège pour anon / authenticated',
           COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.event_regisseur_pins')), false)
           AND to_regclass('public.event_regisseur_pins') IS NOT NULL
           AND NOT has_table_privilege('anon', 'public.event_regisseur_pins', 'SELECT')
           AND NOT has_table_privilege('authenticated', 'public.event_regisseur_pins', 'SELECT'),
           'pg_class / has_table_privilege'
    -- 1A.6
    UNION ALL
    SELECT '1A.6 toutes les tables de public ont la RLS',
           NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity),
           (SELECT COALESCE(string_agg(c.relname, ', '), 'toutes') FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity)
)
SELECT point, CASE WHEN ok THEN 'OK' ELSE 'ÉCHEC' END AS statut, detail
  FROM checks
 ORDER BY point;
```

Sortie de 03 sur la base locale migrée (run 13) :

```text
OK    1A.1 handle_new_user : search_path fixé — search_path=public
OK    1A.1 handle_new_user : téléphone vide ramené à NULL — NULLIF(TRIM(NEW.phone), '')
OK    1A.1 handle_new_user ne lit plus le rôle ni le téléphone des métadonnées — corps de public.handle_new_user
OK    1A.2 otp_codes : aucun privilège pour anon ni authenticated — has_table_privilege
OK    1A.2 otp_codes : aucune politique — aucune
OK    1A.2 otp_codes : RLS activée — pg_class.relrowsecurity
OK    1A.3 aides RLS exécutables par anon et authenticated, STABLE, search_path fixé — is_superadmin:exec:s, has_role:exec:s, is_admin:exec:s, is_controller:exec:s, auth_user_role:exec:s, is_partner_owner:exec:s
OK    1A.3 aucune fonction d'exécution de SQL arbitraire (exec_sql…) — aucune
OK    1A.3 aucune fonction hors liste blanche exécutable par anon / authenticated — aucune
OK    1A.3 privilèges par défaut : EXECUTE retiré à PUBLIC (global) et à anon / authenticated (public) — pg_default_acl
OK    1A.3 RPC métier exécutables par service_role — toutes
OK    1A.3 toute SECURITY DEFINER a un search_path — aucune manquante
OK    1A.3 validate_and_check_in_ticket supprimée — pg_proc
OK    1A.4 aucune politique INSERT / ALL restante sur tickets et payments pour les rôles API — aucune
OK    1A.4 audit_logs : ni INSERT, ni UPDATE, ni DELETE pour anon / authenticated — has_table_privilege
OK    1A.4 politiques d'écriture directe supprimées — aucune
OK    1A.5 event_regisseur_pins : RLS activée, aucun privilège pour anon / authenticated — pg_class / has_table_privilege
OK    1A.5 events sans colonnes regisseur_pin_* — information_schema.columns
OK    1A.5 users_select_policy sans branche « partenaire validé » — users_select_policy: ((id = auth.uid()) OR is_admin() OR is_controller())
OK    1A.6 toutes les tables de public ont la RLS — toutes
```

### 04-smoke-test.md

````markdown
# Lot 1A — 04 : test de fumée avec la clé anon publique

À lancer **après** `02-hotfix.sql` et `03-verification.sql`, depuis n'importe quel poste. Ces commandes n'utilisent que la clé anon publique (celle du navigateur) : elles reproduisent ce qu'un visiteur anonyme peut tenter. Elles n'écrivent rien si le correctif est en place.

```bash
export SUPABASE_URL="https://<ref-projet>.supabase.co"
export ANON_KEY="<clé anon publique du projet>"
```

## 1. Lecture des codes OTP

```bash
curl -s -o /dev/stdout -w "\nHTTP %{http_code}\n" \
  "$SUPABASE_URL/rest/v1/otp_codes?select=phone,code&limit=3" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
```

| | Résultat |
|---|---|
| Avant correctif | `HTTP 200` et une liste de numéros avec leurs codes |
| Attendu après | `HTTP 401` et `{"code":"42501", … "message":"permission denied for table otp_codes"}` |

## 2. Insertion d'un billet

Prendre un `event_id` et un `category_id` publics (visibles sur la page d'un événement publié), puis :

```bash
curl -s -o /dev/stdout -w "\nHTTP %{http_code}\n" -X POST "$SUPABASE_URL/rest/v1/tickets" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" -H "Prefer: return=minimal" \
  -d '{"event_id":"<event_id>","category_id":"<category_id>","user_id":"00000000-0000-0000-0000-000000000000","ticket_number":"TCK-SMOKE-1","qr_code":"EV-QR-SMOKE-1","price":0,"status":"VALIDE"}'
```

| | Résultat |
|---|---|
| Avant correctif | refusé pour anon (`user_id = auth.uid()` faux), mais **accepté** avec le jeton d'un compte gratuit dont c'est l'identifiant |
| Attendu après | `HTTP 401` / `403` et `{"code":"42501", … "new row violates row-level security policy for table \"tickets\""}`, y compris avec le jeton d'un compte gratuit |

Pour tester avec un compte gratuit, remplacer `Authorization: Bearer $ANON_KEY` par le jeton obtenu avec :

```bash
curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" -d '{"email":"<compte-de-test>","password":"<mot de passe>"}'
```

## 3. Fonctions dangereuses

```bash
curl -s -o /dev/stdout -w "\nHTTP %{http_code}\n" -X POST "$SUPABASE_URL/rest/v1/rpc/validate_and_check_in_ticket" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"p_qr_code":"EV-QR-INEXISTANT","p_controller_id":"00000000-0000-0000-0000-000000000000"}'

curl -s -o /dev/stdout -w "\nHTTP %{http_code}\n" -X POST "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" -d '{}'
```

| | Résultat |
|---|---|
| Avant correctif | `HTTP 200` pour `validate_and_check_in_ticket` (réponse `{"success":false,"error":"Ticket invalide ou inexistant"}`) ; `exec_sql` : selon son existence sur le projet |
| Attendu après | `HTTP 404` et `{"code":"PGRST202", … "Could not find the function …"}` pour les deux |

Si l'une de ces commandes ne donne pas le résultat attendu, ne pas considérer le projet comme corrigé : relancer `03-verification.sql` et transmettre sa sortie.
````

---

## 5. Scan de secrets (tout l'historique Git)

**Outils.** gitleaks 8.21.2 (binaire officiel, somme SHA-256 vérifiée contre le fichier de sommes de la version), lancé sur toutes les branches locales et distantes (`--log-opts="--all"`, 72 commits), valeurs masquées (`--redact`). Complété par une recherche des **valeurs exactes** des secrets de `.env.local` dans tous les diffs de l'historique : le script n'affiche que le nom de la clé.

```text
$ gitleaks git . --log-opts="--all" --redact
INF 72 commits scanned.
WRN leaks found: 4

jwt             | .env.test.example:10                         | commit b3baaff | 2026-10-31 | REDACTED
jwt             | .env.test.example:11                         | commit b3baaff | 2026-10-31 | REDACTED
generic-api-key | tests/ticket-transfer-phase2-initiation.test.ts:241 | commit e946fbc | 2026-09-08 | knownTestToken = 'REDACTED'
generic-api-key | tests/scanner-security-hardening.test.ts:248  | commit cc72a6e | 2026-09-07 | testSecret = 'REDACTED'

$ node secrets-exact.js   (valeurs de .env.local recherchées dans 401 673 lignes de diff, 71 commits)
NEXT_PUBLIC_SUPABASE_ANON_KEY (46 car.) : ABSENTE de l'historique
SUPABASE_SERVICE_ROLE_KEY (41 car.) : ABSENTE de l'historique
SAMIRPAY_API_KEY (43 car.) : ABSENTE de l'historique
SAMIRPAY_SECRET_KEY (72 car.) : ABSENTE de l'historique
SAMIRPAY_WEBHOOK_SECRET (72 car.) : ABSENTE de l'historique
MTARGET_USERNAME (15 car.) : ABSENTE de l'historique
MTARGET_PASSWORD (12 car.) : ABSENTE de l'historique
SUPABASE_AUTH_HOOK_SECRET (89 car.) : TROUVÉE 2 fois — 9b2d5ab tests/mtarget-sms.test.ts ; 7489bf3 tests/mtarget-sms.test.ts
RESEND_API_KEY (36 car.) : ABSENTE de l'historique

$ (présence actuelle de la valeur du hook par branche)
main : tests/mtarget-sms.test.ts
origin/main : tests/mtarget-sms.test.ts
origin/ci-results : absente
fix/evenementiel (après 5a20ad5) : absente de l'arbre de travail
```

| Détection | Fichier, commit | Nature | Action |
|---|---|---|---|
| `SUPABASE_AUTH_HOOK_SECRET` (`v1,whsec_…`, masqué) | `tests/mtarget-sms.test.ts:83`, `7489bf3`, `9b2d5ab` | **secret réel** (non vu par gitleaks, trouvé par la recherche exacte) | Rotation : Dashboard Supabase > Authentication > Hooks > Send SMS hook > régénérer le secret ; mettre à jour la variable de l'application ; les PIN régisseur existants deviennent invalides (le sel change), les partenaires doivent les régénérer ; les QR dynamiques se recalculent seuls. Pour la production : secret neuf (docs/deploiement-projet-neuf.md, étape 6). |
| 2 × `jwt` | `.env.test.example:10-11`, `b3baaff` | clés de démonstration **publiques** de Supabase local (`iss: supabase-demo`), ajoutées au lot 0 | aucune |
| `knownTestToken` | `tests/ticket-transfer-phase2-initiation.test.ts:241`, `e946fbc` | constante de test `a1b2c3d4e5f6…` | aucune |
| `testSecret` | `tests/scanner-security-hardening.test.ts:248`, `cc72a6e` | constante de test `0123456789abcdef…` | aucune |

Fichiers jamais versionnés mais sensibles, trouvés par le scan de l'arbre de travail : `.env.local` (secrets réels, ignoré par git, normal) et `.claude/settings.local.json` (commandes `curl` avec une clé du projet distant et appels `rpc/exec_sql` ; ignoré par le `.gitignore` global du poste ; à nettoyer). Les 389 détections dans `.next/` et 6 dans `node_modules/` sont des artefacts de build et de dépendances.

Le nom du projet distant apparaît dans le code public (`NEXT_PUBLIC_SUPABASE_URL` est servi au navigateur) : ce n'est pas un secret.

---

## 6. Suites legacy touchées par ce lot

Définition retenue : une suite est touchée si un de ses tests vérifie un comportement modifié par 1A (attribution de rôle à l'inscription, accès à `otp_codes`, RPC métier, écriture directe sur `tickets` / `payments` / `audit_logs`, lecture anonyme de `users`, colonne du PIN régisseur).

```text
$ node legacy-scan.js tests/legacy    (clients anon / authentifiés et ce qu'ils font)
… 21 suites créent un client avec la clé anon : toutes s'en servent UNIQUEMENT pour signInWithPassword.
écritures / RPC / signUp via un client anon ou authentifié : aucune, dans les 31 suites
createUser avec rôle en métadonnées : admin-anonymize (role: 'CLIENT')
colonnes regisseur_pin_* : aucune suite
```

| Suite legacy | Lien avec 1A | Décision |
|---|---|---|
| `mtarget-sms` | contenait la valeur réelle du secret du hook | **modifiée** : secret remplacé par une valeur factice (le reste de la suite reste en quarantaine, réécriture au lot 3 avec le hook) |
| `controller-14-points`, `security-fixes` | lisent ou écrivent `otp_codes`, mais avec le client `service_role` | inchangées : non affectées par la fermeture aux rôles API |
| `admin-anonymize` | crée un compte avec `role: 'CLIENT'` en métadonnée | inchangée : le rôle CLIENT est celui que le trigger attribue de toute façon |
| les 27 autres | aucune | inchangées |

Aucune suite legacy n'est supprimée : aucune ne teste un comportement de ce lot. Dans les suites actives, seul le test 18 d'`auth-rbac` encodait un comportement corrigé ; il est supprimé (section 1).

---

## 7. Sortie brute de `npm run verify` et CI

Run de référence : **https://github.com/fallouu-mn/event-village/actions/runs/41206780999** (run 13, commit `b6e542e`). Sortie complète : `docs/lot1a-logs/ci-run13-verify.log`. Ci-dessous les blocs verbatim de chaque étape ; seule la sortie détaillée des suites est omise ici.

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

[run-tests] 28 suite(s) — garde-fou : tests/helpers/env.ts — délai/suite : 600.0s
[… 1730 lignes de sortie des suites, intégralement dans docs/lot1a-logs/ci-run13-verify.log …]
═══════════════════ RÉCAPITULATIF ═══════════════════
Suite                                          Statut   Durée     Code  Journal
tests/auth-rbac.test.ts                        PASS     313ms     0     .test-logs/tests__auth-rbac.test.ts.log
tests/e2e-scenarios.test.ts                    PASS     511ms     0     .test-logs/tests__e2e-scenarios.test.ts.log
tests/fondations-lot0.test.ts                  PASS     482ms     0     .test-logs/tests__fondations-lot0.test.ts.log
tests/notifications-and-documents.test.ts      PASS     247ms     0     .test-logs/tests__notifications-and-documents.test.ts.log
tests/parcours/achat-serveur.test.ts           PASS     709ms     0     .test-logs/tests__parcours__achat-serveur.test.ts.log
tests/parcours/attribution-roles.test.ts       PASS     1.2s      0     .test-logs/tests__parcours__attribution-roles.test.ts.log
tests/parcours/bootstrap-superadmin.test.ts    PASS     657ms     0     .test-logs/tests__parcours__bootstrap-superadmin.test.ts.log
tests/parcours/otp-serveur.test.ts             PASS     658ms     0     .test-logs/tests__parcours__otp-serveur.test.ts.log
tests/parcours/pin-regisseur.test.ts           PASS     506ms     0     .test-logs/tests__parcours__pin-regisseur.test.ts.log
tests/partner-auth-complete.test.ts            PASS     501ms     0     .test-logs/tests__partner-auth-complete.test.ts.log
tests/partner-halls-m7.test.ts                 PASS     1.3s      0     .test-logs/tests__partner-halls-m7.test.ts.log
tests/partner-orders-m9.test.ts                PASS     1.4s      0     .test-logs/tests__partner-orders-m9.test.ts.log
tests/payment.test.ts                          PASS     259ms     0     .test-logs/tests__payment.test.ts.log
tests/roles-isolation.test.ts                  PASS     240ms     0     .test-logs/tests__roles-isolation.test.ts.log
tests/scanner-combat-ui.test.ts                PASS     414ms     0     .test-logs/tests__scanner-combat-ui.test.ts.log
tests/scanner-wolof-audio.test.ts              PASS     424ms     0     .test-logs/tests__scanner-wolof-audio.test.ts.log
tests/schema/fonctions-privileges.test.ts      PASS     340ms     0     .test-logs/tests__schema__fonctions-privileges.test.ts.log
tests/schema/hotfix-identique.test.ts          PASS     249ms     0     .test-logs/tests__schema__hotfix-identique.test.ts.log
tests/schema/hotfix-scripts.test.ts            PASS     445ms     0     .test-logs/tests__schema__hotfix-scripts.test.ts.log
tests/schema/rls-toutes-tables.test.ts         PASS     299ms     0     .test-logs/tests__schema__rls-toutes-tables.test.ts.log
tests/security/anon-uniquement.test.ts         PASS     234ms     0     .test-logs/tests__security__anon-uniquement.test.ts.log
tests/security/r1-inscription-roles.test.ts    PASS     1.4s      0     .test-logs/tests__security__r1-inscription-roles.test.ts.log
tests/security/r2-otp-codes.test.ts            PASS     486ms     0     .test-logs/tests__security__r2-otp-codes.test.ts.log
tests/security/r3-fonctions-rpc.test.ts        PASS     592ms     0     .test-logs/tests__security__r3-fonctions-rpc.test.ts.log
tests/security/r4-ecritures-directes.test.ts   PASS     607ms     0     .test-logs/tests__security__r4-ecritures-directes.test.ts.log
tests/security/r5-lectures-anon.test.ts        PASS     541ms     0     .test-logs/tests__security__r5-lectures-anon.test.ts.log
tests/superadmin-complete.test.ts              PASS     381ms     0     .test-logs/tests__superadmin-complete.test.ts.log
tests/ux-performance-and-double-click.test.ts  PASS     798ms     0     .test-logs/tests__ux-performance-and-double-click.test.ts.log
──────────────────────────────────────────────────────
TOTAL : 28 suite(s) — 28 réussie(s), 0 en échec, 0 expirée(s)

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


[verify] OK — 4 étapes réussies en 99s.
```

| Run | Commit | Résultat | Rôle |
|---|---|---|---|
| [8 · 41203526272](https://github.com/fallouu-mn/event-village/actions/runs/41203526272) | 5b510eb | échec attendu | tests rouges (preuve des failles) : 9 suites en échec sur 25 |
| [9 · 41204991502](https://github.com/fallouu-mn/event-village/actions/runs/41204991502) | 9abb5dd | succès | correctifs 1A.1 à 1A.5 : 26 suites vertes |
| [10 · 41205403231](https://github.com/fallouu-mn/event-village/actions/runs/41205403231) | 86cd0b8 | échec | `03-verification.sql` : `operator is not unique: text \|\| "char"` (concaténation de `provolatile`) → corrigé en `0ff3529` |
| [11 · 41205768567](https://github.com/fallouu-mn/event-village/actions/runs/41205768567) | 0ff3529 | succès | 03 tout OK ; la sortie de 01 révèle de fausses ALERTE en section A (section 2, 1A.7) |
| [12 · 41206505617](https://github.com/fallouu-mn/event-village/actions/runs/41206505617) | dd5fa41 | échec attendu | test rouge de la section A de 01 sur comptes synthétiques : 27 suites vertes sur 28 |
| [13 · 41206780999](https://github.com/fallouu-mn/event-village/actions/runs/41206780999) | b6e542e | succès | **run de référence** : section A corrigée, 28 suites vertes |

---

## 8. Points ouverts

### Hors périmètre du lot 1A, exploitables avec un compte gratuit (lot 1B)

1. **Le middleware fait encore confiance aux rôles déclarés dans le jeton.** GoTrue réécrit les métadonnées d'inscription après le trigger de synchronisation : un `signUp` avec `data.roles=['SUPERADMIN']` produit toujours un jeton qui réclame SUPERADMIN, et `updateUser({ data })` permet de le modifier à tout moment. Le middleware ouvre alors les pages `/admin`, `/partner` et `/scan`. Toutes les routes API et la RLS lisent les rôles en base et refusent : l'attaquant voit les écrans sans pouvoir agir. À traiter en priorité au lot 1B (rôles dans `app_metadata` ou lecture en base).
2. **`users_update_own`** permet à un utilisateur de modifier son propre `status` (un compte suspendu se réactive) et ses `phone` / `email` (la connexion par téléphone résout l'email à partir de `users.phone`).
3. **Politiques contrôleur** : `tickets_read` et `users_select_policy` (branche `is_controller()`) donnent à tout contrôleur la lecture de tous les billets et de tous les profils.

### Défauts découverts, non corrigés

4. **OTP non persistés en base par les inscriptions.** `/api/auth/register` et `/api/partner/register` insèrent une colonne `user_id` absente de `otp_codes` ; l'erreur n'est pas vérifiée. Ces codes ne vivent que dans la mémoire du processus : sur un hébergement à plusieurs instances, la vérification échouera dès qu'elle tombe sur une autre instance. À corriger avant la production.
5. **`/api/admin/users` (PATCH)** change `users.role` sans toucher `user_roles` : un compte promu par cette route n'a pas les droits RLS correspondants.

### Exploitation du projet de test

6. Exécuter `01-detection.sql` **avant** `02-hotfix.sql` et conserver le résultat : les sections A, B, D, E et F indiquent si quelqu'un a utilisé les failles. En section A, une ALERTE signifie qu'un rôle élevé est détenu sans trace de la route serveur qui l'attribue. Les comptes admin créés à la main ou par les scripts de l'époque Antigravity sortiront aussi en ALERTE : chaque ligne doit correspondre à un compte que vous connaissez, sinon c'est un compte étranger. Les lectures (codes OTP, profils) ne laissent pas de trace en base : consulter **Logs > API** du tableau de bord pour `/rest/v1/otp_codes`, `/rest/v1/users` et `/rest/v1/rpc/*`.
7. Faire tourner le secret du hook SMS (section 5) même si le projet de test est abandonné : il protège aussi l'envoi de SMS facturés par le compte MTarget réel tant que la route est déployée.

Le lot 1B n'a pas été commencé.
