# LOT 1B — RAPPORT

**Objet :** rôles, politiques partenaire et contrôleur, comptes.
**Branche :** `fix/evenementiel`. Aucun push sur `main`. Rien n'a été exécuté contre le projet Supabase distant. Plus aucun script de hotfix : tout passe par des migrations testées en CI.
**Date :** 31 octobre 2026.

**Résultat :** les dix tâches sont traitées. Chaque défaut est prouvé par un test qui échoue sur le code d'avant correctif (run CI 17, commit `49d41a5`) et passe après (run 19). `npm run verify` est vert : https://github.com/fallouu-mn/event-village/actions/runs/41213878715.

---

## À lire en premier

1. **Correction du rapport du lot 1A (point ouvert n°1).** Le lot 1A affirmait qu'un `signUp` avec `data.roles = ['SUPERADMIN']` ouvrait les pages `/admin`, `/partner` et `/scan`. Les runs 15 et 16 montrent le contraire : à l'inscription, le trigger de synchronisation réécrit `roles` en base et dans le jeton (`['CLIENT']`). La voie réellement exploitable était `auth.updateUser({ data: { roles: ['SUPERADMIN'] } })`, faite par l'utilisateur lui-même après l'inscription : les trois pages étaient servies (run 17, R6 test 2).
2. **Quatre failles exploitables trouvées en appliquant le helper de 1B.6, corrigées dans ce lot :**
   - `/api/tickets/verify` composte (passe UTILISE) n'importe quel billet pour tout compte connecté qui fournit un numéro ou un QR, et renvoie le nom du porteur. Un compte gratuit pouvait « brûler » le billet d'un autre client. Réservé désormais au contrôleur affecté, au partenaire propriétaire de l'événement et aux admins.
   - `/api/tickets?userId=…` renvoyait, sans session, les billets (QR compris) du compte demandé. Le compte vient désormais de la session.
   - `/api/partner/activation` n'avait aucun contrôle d'identité : tout compte connecté démarrait l'essai de n'importe quel partenaire, et la route remettait son compte ACTIF.
   - `/api/partner/team/invite` : si un compte d'authentification existait pour l'email saisi (sans profil trouvé par le numéro), la route réécrivait son email, son téléphone et son **mot de passe**, puis le remettait ACTIF. Un partenaire saisissant l'email d'un client et son propre numéro prenait le contrôle du compte. Refus explicite désormais.
3. **Test du lot 1A qui annulait une migration du lot 1B.** `tests/schema/hotfix-scripts.test.ts` appliquait pour de bon `02-hotfix.sql` (état du lot 1A) sur la base de test partagée, avant les suites de sécurité : il rétablissait `users_select_policy` avec `is_controller()`. Il l'applique désormais dans une transaction annulée (section « Tests existants modifiés »).
4. **Fichier local `.claude/settings.local.json` :** la clé contenue dans les commandes `curl` était la clé **service_role** du projet de test (pas la clé anon), et une huitième commande contenait la vraie clé **Resend** (`curl` vers `api.resend.com`). Les huit entrées sont retirées (1B.0). Les deux recherches `diarra` et `784448091` de ce fichier montrent que le compte `diarra.ndiaye7700@gmail.com` relevé par la détection du lot 1A était connu de l'équipe pendant le développement.

---

## 1. Commits

| Commit | Message |
|---|---|
| 2ec8655 | test(infra)[1B]: fixtures du lot 1B (compte SUSPENDU, billet sur l'événement de B, événement de B annulé et son annulation) et appel du middleware avec une vraie session |
| 12cbe85 | test(securite)[1B.1]: rôles forgés dans user_metadata (signUp, updateUser) → /admin, /partner, /scan redirigent ; fraîcheur des accès sans reconnexion |
| 1f136d9 | test(securite)[1B.2]: colonnes protégées de users (status, phone, email, role, referral_*) refusées par REST, prénom/nom/photo acceptés |
| 4ce29da | test(securite)[1B.3]: le contrôleur ne lit que les billets de son événement affecté et aucun profil tiers ; Realtime du scanner filtré |
| 5353ac1 | test(securite)[1B.4]: écritures partenaire par REST (publication, mise en avant, stock, création) et annulations d'autres partenaires |
| 822b211 | test(securite)[1B.5]: lecture de ses rôles sans 42P17, aucune écriture REST dans user_roles (dont ADMIN vers SUPERADMIN) |
| f1c4321 | test(parcours)[1B.6]: comptes non ACTIF refusés sur /api/partner et /api/tickets, aucune réactivation par une route partenaire, routes sans contrôle d'identité |
| 63517a9 | test(parcours)[1B.7]: OTP d'inscription client et partenaire vérifiés depuis une autre instance (cache mémoire vidé) |
| c261503 | test(parcours)[1B.8]: PATCH /api/admin/users ajoute et retire les rôles dans user_roles, la RLS suit |
| 131a85a | test(parcours)[1B.9]: aucune route de débogage ; anonymisation qui brouille l'identifiant de connexion et bannit le compte |
| 52332ae | test(securite)[1B.1]: précondition du cas signUp sur les claims du jeton (en base, le trigger a déjà réécrit les rôles) |
| c50a03e | test(securite)[1B.4]: annulation de B sur un événement encore publié, et écriture d'une annulation sur l'événement de B |
| fcc9094 | test(parcours)[1B.6]: vérification de billet sur un billet dédié (CLIENT, partenaire d'un autre événement, contrôleur affecté) |
| 9d9c0f9 | test(parcours)[1B.7]: lecture du dernier SMS contenant un code (l'inscription partenaire envoie ensuite un avis sans code) |
| 2402b00 | test(securite)[1B.1]: cas signUp sans précondition (runs 15 et 16 : ni la base ni le jeton ne portent les rôles forgés) ; garde-fou de non-régression |
| 49d41a5 | test(parcours)[1B.6]: invitation avec l'email d'un compte existant et un autre numéro → refus, identifiants du titulaire intacts |
| 0c4eab0 | fix(securite)[1B.1]: rôles lus dans user_roles (middleware, /api/auth/me, AuthProvider, inscription, menu), plus jamais dans user_metadata ; aucun repli sur le jeton |
| c8425a8 | fix(securite)[1B.2]: public.users modifiable par REST uniquement sur first_name, last_name, avatar_url (privilèges par colonne) |
| 6f99824 | fix(securite)[1B.3]: tickets_read limité aux événements affectés du contrôleur ; users_select_policy sans is_controller() |
| 796c82b | fix(securite)[1B.4]: plus d'écriture partenaire par REST sur events / ticket_categories ; event_cancellations : lecture propriétaire ou admin, écritures service_role |
| 8937ec9 | fix(securite)[1B.5]: politiques user_roles sans récursion (is_admin()), aucune écriture REST |
| 2b4e0cd | fix(otp)[1B.7]: codes OTP en base uniquement (otp_codes), enregistrés avant l'envoi, vérifiés et consommés par toute instance ; cache mémoire supprimé |
| 131a329 | fix(securite)[1B.6]: helper requireActiveSession sur toutes les routes /api/partner et /api/tickets ; aucune réactivation de compte par une route partenaire (refus journalisé) ; activation d'essai, liste et vérification de billets limitées au bon compte ; invitation sans réécriture d'un compte existant |
| b9f48b7 | fix(roles)[1B.8]: PATCH /api/admin/users écrit user_roles (ajout et retrait, journalisé) ; setUserRoles vérifie chaque écriture ; getServerSessionUser n'ajoute plus users.role |
| 106615e | fix(securite)[1B.9]: suppression de /api/test-notify-superadmins ; anonymisation qui brouille l'identifiant de connexion, bannit le compte et s'interrompt sur erreur |
| cd0179d | fix(securite)[1B.1]: commentaire de roles.ts reformulé (citait le nom de la fonction supprimée, relevé par le contrôle statique R6) |
| 02a7775 | test(schema)[1B]: 02-hotfix.sql appliqué dans une transaction annulée (il rétablissait la politique users du lot 1A pour les suites suivantes) |
| 999bc59 | test(legacy)[1B]: suites legacy alignées sur le lot 1B (rôles hors user_metadata, vérification de billet authentifiée, anonymisation) ; cas fondés sur les failles corrigées supprimés |

Ce rapport est ajouté par le commit qui suit le dernier de cette liste. Le nettoyage 1B.0 porte sur un fichier local ignoré par Git : il n'a pas de commit.

**Ordre des commits de correctifs.** 1B.7 est committé avant 1B.6 : la route d'invitation, corrigée en 1B.6, utilise le magasin OTP créé en 1B.7. Deux fichiers partagés ont été découpés par hunk : `lib/auth/roles.ts` (suppression des lectures `user_metadata` en 1B.1, `setUserRoles` en 1B.8) et `lib/auth/session.ts` (helper en 1B.6, rôles en 1B.8). La route d'invitation porte aussi, dans le commit 1B.6, l'abandon du rôle en `user_metadata` (1B.1) et le passage au magasin OTP (1B.7).

### Règles de test appliquées

- Tests de sécurité (`tests/security/r6` à `r10`) : clé anon, `signUp` et `signInWithPassword` uniquement ; `anon-uniquement.test.ts` reste vert.
- Tests de parcours (`tests/parcours`) : routes appelées directement avec leur propre client service_role, comme en production ; préparation des comptes par le service_role.
- Le middleware est appelé avec de vrais cookies `@supabase/ssr`, produits par la bibliothèque elle-même (`tests/helpers/middleware.ts`).
- Fixtures ajoutées au seed : compte `SUSPENDED` (client SUSPENDU), billet `TCK-FIXTURE-CLIENT-BIS-B-1` sur l'événement de B, événement `B_ANNULATION` (encore PUBLIE) avec sa fiche d'annulation.

### Tests modifiés (signalement)

- **`tests/parcours/otp-serveur.test.ts`** (créé au lot 1A) : réécrit pour 1B.7. Le cache mémoire est vidé entre émission et vérification (autre instance simulée) ; ajout de l'inscription partenaire. Après le run 15, la lecture du SMS prend le dernier message contenant un code : l'inscription partenaire envoie ensuite un avis sans code. Les deux cas d'inscription restent rouges au run 17, pour la bonne raison (code absent de `otp_codes`).
- **`tests/security/r6-roles-jeton.test.ts`, cas `signUp`** : la précondition « métadonnée forgée présente » (run 15), puis « jeton porteur des rôles forgés » (run 16), était fausse ; elle est retirée. Le cas reste comme garde-fou, vert avant et après correctif (point 1 ci-dessus).
- **`tests/security/r9-partenaire-ecritures.test.ts`** : au run 15, la lecture des annulations de B passait parce que l'événement de la fixture était ANNULE, donc invisible de A par la politique des événements. Fixture déplacée sur un événement encore PUBLIE et cas d'écriture sur l'événement de B ajouté ; rouges au run 17.
- **`tests/parcours/statut-compte.test.ts`, cas vérification de billet** : au run 15, la vérification par un CLIENT a composté le billet de référence partagé. Le cas utilise désormais un billet dédié et vérifie aussi le partenaire d'un autre événement (403) et le contrôleur affecté (200).
- **`tests/parcours/roles-fraicheur.test.ts`** : vert avant correctif (run 15). Le middleware appelle `getUser()`, qui relit l'utilisateur en base à chaque requête : les métadonnées synchronisées par le trigger étaient déjà fraîches. Le test reste un garde-fou de la fraîcheur après passage à `user_roles`.
- **`tests/schema/hotfix-scripts.test.ts`** (lot 1A) : `02-hotfix.sql` est appliqué deux fois dans une transaction annulée au lieu d'être committé (point 3 ci-dessus). L'idempotence reste prouvée ; rouge-vert de R8 au run 18 puis 19.
- **Instabilité non liée au lot** : `tests/partner-halls-m7.test.ts` (cas 2, réservations simultanées) a échoué une fois au run 15 sur `deadlock detected`, avant tout correctif du lot ; vert aux runs 16 et suivants. Signalé, non modifié.

---

## 2. Tâches : grep, test rouge, correctif, test vert

Avant correctif : run CI 17 (`41212525502`, commit `49d41a5`), tests dans leur version finale, aucun correctif appliqué. Après : run 19 (`41213878715`, commit `999bc59`). Les greps sont exécutés sur l'arbre du commit `49d41a5`. Journaux bruts complets sur la branche `ci-results` (`runs/17-41212525502/`, `runs/19-41213878715/`).

### 1B.0 — Nettoyage local

```text
$ node settings-scan.js .claude/settings.local.json .env.local
fichier : .claude/settings.local.json (4647 car.)
entrées visant le projet distant ou contenant une clé : 8
- permissions.allow.3 : valeur de RESEND_API_KEY
- permissions.allow.18 : hôte distant, *.supabase.co, valeur de SUPABASE_SERVICE_ROLE_KEY, clé sb_
- permissions.allow.19 : hôte distant, *.supabase.co, valeur de SUPABASE_SERVICE_ROLE_KEY, clé sb_
- permissions.allow.21 : hôte distant, *.supabase.co, valeur de SUPABASE_SERVICE_ROLE_KEY, clé sb_
- permissions.allow.22 : hôte distant, *.supabase.co, valeur de SUPABASE_SERVICE_ROLE_KEY, clé sb_
- permissions.allow.23 : hôte distant, *.supabase.co, valeur de SUPABASE_SERVICE_ROLE_KEY, clé sb_
- permissions.allow.24 : hôte distant, *.supabase.co, valeur de SUPABASE_SERVICE_ROLE_KEY, clé sb_
- permissions.allow.25 : hôte distant, *.supabase.co, valeur de SUPABASE_SERVICE_ROLE_KEY, clé sb_

$ node -e '…'   (aperçu masqué : clés et URL du projet remplacées)
3 Bash(curl -s -o /dev/null -w "%{http_code}" -X GET "https://api.resend.com/domains" -H "Authorization: Bearer <RESEND_API_KEY>")
18 Bash(curl -s '<NEXT_PUBLIC_SUPABASE_URL>/rest/v1/users?phone=like.*784448091*&select=id,phone,email,first_name,last_name,role' -H 'apikey: <SUPABASE_SERVICE_ROL
19 Bash(curl -s '<NEXT_PUBLIC_SUPABASE_URL>/rest/v1/users?select=id,phone,email,first_name,last_name,role&limit=20' -H 'apikey: <SUPABASE_SERVICE_ROLE_KEY>' -H 'Au
21 Bash(curl -s '<NEXT_PUBLIC_SUPABASE_URL>/rest/v1/users?select=id,phone,email,first_name,last_name,role&limit=20' -H 'apikey: <SUPABASE_SERVICE_ROLE_KEY>' -H 'Au
22 Bash(curl -s '<NEXT_PUBLIC_SUPABASE_URL>/rest/v1/users?email=eq.diarra@gmail.com&select=id,phone,email,first_name,last_name,role' -H 'apikey: <SUPABASE_SERVICE_
23 Bash(curl -s '<NEXT_PUBLIC_SUPABASE_URL>/rest/v1/users?email=like.*diarra*&select=id,phone,email,first_name,last_name,role' -H 'apikey: <SUPABASE_SERVICE_ROLE_K
24 Bash(curl -s -X POST <NEXT_PUBLIC_SUPABASE_URL>/rest/v1/rpc/ -H 'apikey: <SUPABASE_SERVICE_ROLE_KEY>' -H 'Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>' -H 
25 Bash(curl -s -X POST <NEXT_PUBLIC_SUPABASE_URL>/rest/v1/rpc/exec_sql -H 'apikey: <SUPABASE_SERVICE_ROLE_KEY>' -H 'Authorization: Bearer <SUPABASE_SERVICE_ROLE_K
deny/ask: ["allow","additionalDirectories"] total allow: 42

$ node settings-scan.js .claude/settings.local.json .env.local --apply
après nettoyage : 2527 car. ; motifs restants : aucun

$ node -e 'JSON.parse(…settings.local.json…)'
JSON valide, allow: 34

$ node settings-scan.js .claude/settings.local.json .env.local
fichier : .claude/settings.local.json (2527 car.)
entrées visant le projet distant ou contenant une clé : 0

$ git check-ignore -v .claude/settings.local.json
"C:\\Users\\DELL/.config/git/ignore":1:**/.claude/settings.local.json	.claude/settings.local.json
```

### 1B.1 — Rôles dans le jeton

**Grep de dépendance** (lectures de rôles dans `user_metadata`) :

```text
$ grep -rn -E "user_metadata\??\.roles?|parseRoles|meta\.role" app components hooks lib middleware.ts
app/register/page.tsx:167:                userRole = (userProfile as { role?: string } | null)?.role || (signInData.user.user_metadata?.role as string) || 'CLIENT';
components/layout/AppLayout.tsx:52:  const rawRole = mounted ? (profile?.role || (user?.user_metadata?.role as string) || '') : '';
components/providers/AuthProvider.tsx:48:function parseRolesFromMetadata(meta: Record<string, unknown> | undefined): string[] {
components/providers/AuthProvider.tsx:50:    const rolesField = meta.roles;
components/providers/AuthProvider.tsx:52:    const legacyRole = meta.role as string | undefined;
components/providers/AuthProvider.tsx:99:                const metaRoles = parseRolesFromMetadata(meta as Record<string, unknown>);
components/providers/AuthProvider.tsx:121:                const sessionRoles = parseRolesFromMetadata(meta as Record<string, unknown>);
components/providers/AuthProvider.tsx:128:                    role: (meta.role as UserProfile['role']) || 'CLIENT',
lib/auth/roles.ts:39:export function parseRolesFromJwt(userMetadata: Record<string, unknown> | undefined | null): string[] {
middleware.ts:36:function parseRoles(userMetadata: Record<string, unknown> | undefined | null): string[] {
middleware.ts:126:    let roles = parseRoles(user.user_metadata);
```

**Correctif.** Le middleware lit les rôles dans `public.user_roles` avec la session de l'utilisateur (politique « ses propres rôles », réparée en 1B.5), uniquement sur les zones protégées et les pages d'authentification. Un échec de lecture refuse l'accès (503 ou redirection) et est journalisé ; plus de repli sur le jeton ni sur `users.role`. `/api/auth/me` ne lit plus que `user_roles`, et remonte ses erreurs. L'AuthProvider ne prend profil et rôles que de `/api/auth/me` : plus de lecture directe, plus de `user_metadata`. La page d'inscription et le menu (`AppLayout`) n'utilisent plus `user_metadata.role` ; le menu n'accorde plus l'interface SUPERADMIN aux numéros de bootstrap. Les fonctions inutilisées `parseRolesFromJwt` et `getUserRolesFromDb` (repli silencieux sur CLIENT) sont supprimées. Les routes touchées par ce lot n'écrivent plus de rôle dans `user_metadata`.

Le trigger `sync_user_roles_to_jwt` continue de recopier les rôles dans `raw_user_meta_data` : plus aucun code ne les lit (contrôle statique R6, test 3), et le script de détection du lot 1A s'en sert. Son retrait est un point ouvert.

**security/r6-roles-jeton**

Run 17 (avant correctif) :

```text
    ok 1 - signUp avec data.roles = [SUPERADMIN] → /admin, /partner et /scan redirigent
    not ok 2 - compte CLIENT qui fait updateUser({ data: { roles: [SUPERADMIN] } }) → idem
        → métadonnées modifiées par updateUser : accès accordé alors qu'il doit être redirigé :
        → /admin/dashboard → HTTP 200 (page servie)
        → /partner/dashboard → HTTP 200 (page servie)
        → /scan → HTTP 200 (page servie)
    not ok 3 - aucun code applicatif ne lit les rôles dans user_metadata
        → lectures de rôles dans user_metadata :
        → app/register/page.tsx:167 userRole = (userProfile as { role?: string } | null)?.role || (signInData.user.user_metadata?.role as string) || 'CLIENT';
        → components/layout/AppLayout.tsx:52 const rawRole = mounted ? (profile?.role || (user?.user_metadata?.role as string) || '') : '';
        → components/providers/AuthProvider.tsx:48 function parseRolesFromMetadata(meta: Record<string, unknown> | undefined): string[] {
not ok 1 - R6 — rôles déclarés dans user_metadata
# pass 1
# fail 2
```

Run 19 (après correctif) :

```text
    ok 1 - signUp avec data.roles = [SUPERADMIN] → /admin, /partner et /scan redirigent
    ok 2 - compte CLIENT qui fait updateUser({ data: { roles: [SUPERADMIN] } }) → idem
    ok 3 - aucun code applicatif ne lit les rôles dans user_metadata
ok 1 - R6 — rôles déclarés dans user_metadata
# pass 3
# fail 0
```

**parcours/roles-fraicheur**

Run 17 (avant correctif) :

```text
    ok 1 - contrôleur promu puis retiré : /controller/scanner suit sans reconnexion
    ok 2 - partenaire promu puis retiré : /partner/dashboard suit sans reconnexion
    ok 3 - contrôleur SUSPENDU : /controller/scanner redirige
ok 1 - Fraîcheur des rôles dans le middleware (même session)
# pass 3
# fail 0
```

Run 19 (après correctif) :

```text
    ok 1 - contrôleur promu puis retiré : /controller/scanner suit sans reconnexion
    ok 2 - partenaire promu puis retiré : /partner/dashboard suit sans reconnexion
    ok 3 - contrôleur SUSPENDU : /controller/scanner redirige
ok 1 - Fraîcheur des rôles dans le middleware (même session)
# pass 3
# fail 0
```

### 1B.2 — `users_update_own`

**Grep de dépendance** (écritures sur `public.users` et client utilisé) :

```text
$ node writes-scan.js . users   (écritures, client utilisé)
users	update	app/api/admin/partners/[id]/status/route.ts:97	[service_role]	{ status: userStatus, role: userRole, updated_at: new Date().toISOString(), }
users	update	app/api/admin/users/route.ts:245	[service_role]	
users	update	app/api/partner/activation/route.ts:81	[service_role]	{ status: 'ACTIF', updated_at: new Date().toISOString() }
users	update	app/api/partner/team/assignments/route.ts:122	[service_role]	{ role: 'CONTROLEUR', status: 'ACTIF', updated_at: new Date().toISOString() }
users	update	app/api/partner/team/assignments/route.ts:213	[service_role]	{ status: 'ACTIF' }
users	update	app/api/partner/team/controller/[controllerId]/route.ts:113	[service_role]	{ role: 'CLIENT', status: 'ACTIF', }
users	update	app/api/partner/team/controller/[controllerId]/route.ts:132	[service_role]	{ role: 'CLIENT', status: 'ACTIF', }
users	update	app/api/partner/team/invite/route.ts:194	[service_role]	{ role: 'CONTROLEUR', status: 'ACTIF', ...(first_name && first_name !== 'Contrôleur' ? { first_name }
users	update	app/api/partner/team/invite/route.ts:214	[service_role]	{ first_name, ...(last_name ? { last_name }
users	update	lib/admin/admin.service.ts:309	[service_role]	{ first_name: 'Utilisateur', last_name: 'Supprimé', email: anonymizedEmail, phone: anonymizedPhoneToUse, status: finalStatus as any, referra
users	update	lib/admin/admin.service.ts:325	[service_role]	{ first_name: 'Utilisateur', last_name: 'Supprimé', email: anonymizedEmail, phone: anonymizedPhoneToUse, status: finalStatus as any, referra
users	update	lib/admin/admin.service.ts:343	[service_role]	{ first_name: 'Utilisateur', last_name: 'Supprimé', email: anonymizedEmail, phone: anonymizedPhoneToUse, status: finalStatus as any, referra
users	update	lib/admin/bootstrap-superadmin.ts:61	[service_role]	{ role: 'SUPERADMIN', status: 'ACTIF', updated_at: new Date().toISOString() }
users	upsert	app/api/admin/users/route.ts:145	[service_role]	{ id: userId, first_name: firstName.trim(), last_name: lastName.trim(), phone: normalizedPhone, email: effectiveEmail, role: targetRole, st
users	upsert	app/api/auth/register/route.ts:87	[service_role]	{ id: userId, first_name: firstName.trim(), last_name: lastName.trim(), phone: normalizedPhone, email: effectiveEmail, role: assignedRole,
users	upsert	app/api/partner/register/route.ts:104	[service_role]	{ id: userId, first_name: data.firstName.trim(), last_name: data.lastName.trim(), phone: normalizedPhone, email: effectiveEmail, role:
users	upsert	app/api/partner/team/invite/route.ts:279	[service_role]	
```

Aucune écriture applicative ne passe par un client anon ou authenticated. Le profil (`app/profile/page.tsx`) affiche téléphone et email en lecture seule : aucune interface ne permet de les changer.

**Correctif** (`20261031000003`). `REVOKE UPDATE` sur `public.users` pour anon et authenticated, puis `GRANT UPDATE (first_name, last_name, avatar_url)` à authenticated. `public.users` n'a pas de colonne « préférences ». La route serveur de changement de téléphone ou d'email avec OTP (§153) n'existe pas : la modification est **bloquée et documentée** plutôt que créée, faute d'écran qui l'utilise.

**security/r7-profil-colonnes**

Run 17 (avant correctif) :

```text
    not ok 1 - compte SUSPENDU qui tente status = ACTIF → refusé, statut inchangé
        → réactivation de son propre compte (status) : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    not ok 2 - CLIENT qui change son téléphone par REST → refusé
        → changement de téléphone par REST : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    not ok 3 - CLIENT qui change son email, son rôle, son statut de parrainage ou son code → refusé
        → modification de users.email : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    ok 4 - CLIENT qui change son prénom, son nom et sa photo → accepté
not ok 1 - R7 — colonnes protégées de public.users
# pass 1
# fail 3
```

Run 19 (après correctif) :

```text
    ok 1 - compte SUSPENDU qui tente status = ACTIF → refusé, statut inchangé
    ok 2 - CLIENT qui change son téléphone par REST → refusé
    ok 3 - CLIENT qui change son email, son rôle, son statut de parrainage ou son code → refusé
    ok 4 - CLIENT qui change son prénom, son nom et sa photo → accepté
ok 1 - R7 — colonnes protégées de public.users
# pass 4
# fail 0
```

### 1B.3 — Politiques contrôleur

**Grep de dépendance** (lectures navigateur de `users` et `tickets`, nom du porteur au scan) :

```text
$ node writes-scan.js . users,tickets --reads | grep -v service_role
users	select	app/login/page.tsx:189	[navigateur (JWT utilisateur) + composant client]	
users	select	app/register/page.tsx:162	[navigateur (JWT utilisateur) + composant client]	
users	select	components/providers/AuthProvider.tsx:87	[navigateur (JWT utilisateur) + composant client]	
users	select	lib/admin/admin-auth.ts:96	[service_role + serveur avec JWT utilisateur]	
users	select	middleware.ts:133	[serveur avec JWT utilisateur]	
users	select	middleware.ts:192	[serveur avec JWT utilisateur]	
$ grep -n "holder_name\|users!tickets_user_id_fkey\|getServiceRoleClient" app/api/controller/scan/route.ts | head
4:import { getServiceRoleClient } from '@/lib/supabase/server';
69:        const supabase = getServiceRoleClient();
93:                users:users!tickets_user_id_fkey (id, first_name, last_name, email, phone),
159:                        holder_name: holderName,
225:                        holder_name: holderName,
260:                                holder_name: holderName,
```

Les lectures navigateur de `users` ne portent que sur la ligne de l'utilisateur connecté. Le nom du porteur est servi par `/api/controller/scan` avec le service_role.

**Correctif** (`20261031000004`). `tickets_read` : la branche `is_controller()` devient `is_controller() AND` affectation à l'événement (`event_controllers`) ; les admins gardent la lecture complète par `is_admin()`. `users_select_policy` : `id = auth.uid() OR is_admin()`. Seule `tickets_read` utilise encore `is_controller()` parmi les politiques du schéma.

L'abonnement Realtime du scanner (UPDATE sur `tickets`, filtre `event_id`) reçoit les mises à jour de l'événement affecté et plus celles d'un autre événement. Avant correctif, le billet de B arrivait au contrôleur de A.

**security/r8-controleur-lectures**

Run 17 (avant correctif) :

```text
    not ok 1 - CONTROLLER_A ne lit pas les billets de l'événement de B
        → billets de B lisibles par le contrôleur de A : [{"id":"879ced86-e12c-4547-ae36-f10e576f86b9","ticket_number":"TCK-FIXTURE-CLIENT-BIS-B-1"}]
        → +     id: '879ced86-e12c-4547-ae36-f10e576f86b9',
        → +     ticket_number: 'TCK-FIXTURE-CLIENT-BIS-B-1'
        → - []
    not ok 2 - CONTROLLER_A ne lit aucun billet hors de son événement affecté, même sans filtre
        → billets hors affectation lisibles : 2
        → +     event_id: '69ae92b0-e495-4524-b5c3-480e2e292278',
        → +     id: '70060749-4097-4536-81f1-f1bf10c93ca3',
        → +     user_id: '49a3706e-b398-48b4-adf5-f519ddc584e5'
    ok 3 - CONTROLLER_A lit encore les billets de son événement affecté
    not ok 4 - CONTROLLER_A ne lit aucun profil d'autre utilisateur
        → profils tiers lisibles par un contrôleur
        → +   'parcours-fraicheur-ctrl-bae6a53eab@test.eventvillage.local',
        → +   'client@test.eventvillage.local',
        → +   'client-bis@test.eventvillage.local',
not ok 1 - R8 — lectures du contrôleur
# pass 1
# fail 3
```

Run 19 (après correctif) :

```text
    ok 1 - CONTROLLER_A ne lit pas les billets de l'événement de B
    ok 2 - CONTROLLER_A ne lit aucun billet hors de son événement affecté, même sans filtre
    ok 3 - CONTROLLER_A lit encore les billets de son événement affecté
    ok 4 - CONTROLLER_A ne lit aucun profil d'autre utilisateur
ok 1 - R8 — lectures du contrôleur
# pass 4
# fail 0
```

**parcours/realtime-scanner**

Run 17 (avant correctif) :

```text
    not ok 1 - CONTROLLER_A reçoit les mises à jour des billets de son événement, pas celles de l'événement de B
        → mises à jour d'un billet de B reçues par le contrôleur de A : [{"eventId":"71dbfeff-5b68-4324-a22c-f533e8c2d7cc","ticketNumber":"TCK-FIXTURE-CLIENT-BIS-B-1"}]
        → +     eventId: '71dbfeff-5b68-4324-a22c-f533e8c2d7cc',
        → +     ticketNumber: 'TCK-FIXTURE-CLIENT-BIS-B-1'
        → - []
not ok 1 - Realtime du scanner
# pass 0
# fail 1
```

Run 19 (après correctif) :

```text
    ok 1 - CONTROLLER_A reçoit les mises à jour des billets de son événement, pas celles de l'événement de B
ok 1 - Realtime du scanner
# pass 1
# fail 0
```

### 1B.4 — Politiques partenaire

**Grep de dépendance** (écritures sur `events`, `ticket_categories`, `event_cancellations`) :

```text
$ node writes-scan.js . events,ticket_categories,event_cancellations
event_cancellations	insert	lib/events/event-cancellation.service.ts:147	[service_role]	{ event_id: eventId, cancelled_by: userId, internal_reason: internalReason, public_notice: notice, cancelled_at: 
events	delete	lib/events/event.service.ts:175	[service_role]	
events	delete	lib/events/event.service.ts:690	[service_role]	
events	insert	lib/events/event.service.ts:119	[service_role]	
events	update	app/api/admin/promotions/route.ts:76	[service_role]	{ is_featured: true, featured_until: end_date ? new Date(end_date).toISOString() : null }
events	update	lib/events/event-cancellation.service.ts:179	[service_role]	{ status: 'ANNULE', practical_info: updatedPracticalInfo, updated_at: new Date().toISOString(), }
events	update	lib/events/event-cancellation.service.ts:192	[service_role]	{ status: 'SUSPENDU', practical_info: updatedPracticalInfo, updated_at: new Date().toISOString(), }
events	update	lib/events/event.service.ts:339	[service_role]	
events	update	lib/events/event.service.ts:805	[service_role]	{ status: newStatus, updated_at: new Date().toISOString(), }
ticket_categories	delete	lib/events/event.service.ts:689	[service_role]	
ticket_categories	insert	lib/events/event.service.ts:170	[service_role]	
ticket_categories	insert	lib/events/event.service.ts:630	[service_role]	
ticket_categories	update	lib/events/event.service.ts:1105	[service_role]	
ticket_categories	update	lib/events/event.service.ts:1208	[service_role]	
ticket_categories	update	lib/events/event.service.ts:1540	[service_role]	{ held_quantity: nextHeld, updated_at: new Date().toISOString(), }
ticket_categories	update	lib/events/event.service.ts:1612	[service_role]	{ held_quantity: nextHeld, updated_at: new Date().toISOString(), }
ticket_categories	update	lib/events/event.service.ts:1698	[service_role]	{ sold_quantity: currentSold - 1, updated_at: new Date().toISOString(), }
ticket_categories	update	lib/events/event.service.ts:550	[service_role]	
$ node writes-scan.js . event_cancellations --reads
event_cancellations	insert	lib/events/event-cancellation.service.ts:147	[service_role]	{ event_id: eventId, cancelled_by: userId, internal_reason: internalReason, public_notice: notice, cancelled_at: 
event_cancellations	select	lib/events/event-cancellation.service.ts:800	[service_role]	
```

Toutes les écritures passent par le service_role : les politiques n'accordent plus d'écriture au partenaire.

**Correctif** (`20261031000005`). `events_partner_manage` et `ticket_categories_partner_manage` (FOR ALL) remplacées par `events_admin_manage` et `ticket_categories_admin_manage` (`is_admin()`). Le partenaire lit toujours ses événements et catégories par les politiques de lecture existantes. `event_cancellations` : les quatre politiques comparaient `events.partner_id` à `SELECT partner_id FROM partners …`. `partners` n'a pas de colonne `partner_id` : PostgreSQL résolvait le nom sur la requête externe (`events.partner_id`), la condition était toujours vraie pour un partenaire. Lecture désormais propriétaire de l'événement ou admin ; `REVOKE INSERT, UPDATE, DELETE` pour anon et authenticated.

**security/r9-partenaire-ecritures**

Run 17 (avant correctif) :

```text
    not ok 1 - partenaire A qui passe son BROUILLON en PUBLIE → refusé
        → publication directe acceptée : [{"id":"c52798d1-707e-443d-9f87-729dc6f89f04","status":"PUBLIE"}]
    not ok 2 - partenaire A qui met son événement en avant (is_featured) → refusé
        → mise en avant directe acceptée : [{"id":"0016f200-9bfc-42f5-9f94-a387c21283fd","is_featured":true}]
    not ok 3 - partenaire A qui modifie sold_quantity / held_quantity de sa catégorie → refusé
        → modification directe des compteurs de stock acceptée
    not ok 4 - partenaire A qui crée un événement PUBLIE par REST → refusé
        → création directe d'un événement : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    not ok 5 - partenaire A qui lit les annulations de B → rien
        → annulations d'autres partenaires lisibles : 1
        → +     event_id: 'd45eee6c-9494-401e-8d67-d1115b1bba1c',
        → +     id: '980c4b9e-a49e-4d4a-ab6a-5dc7aaebb16a'
        → - []
    not ok 6 - partenaire A qui écrit une annulation sur l'événement publié de B → refusé
        → écriture d'une annulation sur l'événement d'un autre partenaire : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    not ok 7 - partenaire A qui écrit une annulation par REST → refusé
        → écriture directe dans event_cancellations : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
not ok 1 - R9 — écritures partenaire par REST
# pass 0
# fail 7
```

Run 19 (après correctif) :

```text
    ok 1 - partenaire A qui passe son BROUILLON en PUBLIE → refusé
    ok 2 - partenaire A qui met son événement en avant (is_featured) → refusé
    ok 3 - partenaire A qui modifie sold_quantity / held_quantity de sa catégorie → refusé
    ok 4 - partenaire A qui crée un événement PUBLIE par REST → refusé
    ok 5 - partenaire A qui lit les annulations de B → rien
    ok 6 - partenaire A qui écrit une annulation sur l'événement publié de B → refusé
    ok 7 - partenaire A qui écrit une annulation par REST → refusé
ok 1 - R9 — écritures partenaire par REST
# pass 7
# fail 0
```

### 1B.5 — Politiques récursives sur `user_roles`

**Grep de dépendance** (accès à `user_roles`) :

```text
$ node writes-scan.js . user_roles --reads
user_roles	delete	app/api/partner/team/controller/[controllerId]/route.ts:130	[service_role]	
user_roles	delete	lib/admin/admin.service.ts:359	[service_role]	
user_roles	delete	lib/auth/roles.ts:132	[service_role]	
user_roles	delete	lib/auth/roles.ts:98	[service_role]	
user_roles	insert	lib/auth/roles.ts:123	[service_role]	{ user_id: userId, role }
user_roles	insert	lib/auth/roles.ts:66	[service_role]	{ user_id: userId, role }
user_roles	select	app/api/auth/me/route.ts:30	[service_role]	
user_roles	select	app/api/controller/setup/route.ts:126	[service_role]	
user_roles	select	app/api/partner/team/invite/route.ts:155	[service_role]	
user_roles	select	app/login/page.tsx:190	[navigateur (JWT utilisateur) + composant client]	
user_roles	select	lib/admin/admin-auth.ts:101	[service_role + serveur avec JWT utilisateur]	
user_roles	select	lib/admin/bootstrap-superadmin.ts:42	[service_role]	
user_roles	select	lib/auth/roles.ts:111	[service_role]	
user_roles	select	lib/auth/roles.ts:53	[service_role]	
user_roles	select	lib/auth/session.ts:50	[service_role]	
user_roles	select	middleware.ts:182	[serveur avec JWT utilisateur]	
user_roles	upsert	app/api/partner/team/invite/route.ts:299	[service_role]	{ user_id: controllerUserId, role: 'CLIENT' }
user_roles	upsert	lib/auth/roles.ts:88	[service_role]	{ user_id: userId, role }
```

Écritures : service_role uniquement. Lectures sous la session de l'utilisateur : `app/login/page.tsx` et le middleware, qui échouaient en 42P17.

**Correctif** (`20261031000006`). `user_roles_select_own` : `user_id = auth.uid() OR is_admin()`. **Écart assumé par rapport à la consigne** (« réécris-les avec is_admin() ») : la politique d'écriture `user_roles_admin_manage` n'est pas réécrite mais supprimée, avec `REVOKE INSERT, UPDATE, DELETE`. Réécrite avec `is_admin()`, elle aurait permis à un ADMIN de s'attribuer SUPERADMIN par REST (test R10 n°4).

**security/r10-user-roles**

Run 17 (avant correctif) :

```text
    not ok 1 - un compte authenticated lit ses propres rôles sans erreur 42P17
        → lecture de ses rôles : 42P17 infinite recursion detected in policy for relation "user_roles"
        → +   code: '42P17',
        → +   details: null,
        → +   hint: null,
    not ok 2 - un CLIENT ne lit pas les rôles des autres comptes
        → lecture des rôles : 42P17 infinite recursion detected in policy for relation "user_roles"
        → +   code: '42P17',
        → +   details: null,
        → +   hint: null,
    not ok 3 - un ADMIN lit les rôles des autres comptes
        → lecture admin des rôles : 42P17 infinite recursion detected in policy for relation "user_roles"
        → +   code: '42P17',
        → +   details: null,
        → +   hint: null,
    not ok 4 - un ADMIN ne s'attribue pas SUPERADMIN par REST
        → auto-attribution de SUPERADMIN par un ADMIN : refus attendu (permission / RLS / objet inexistant), obtenu code=42P17 message=infinite recursion detected in policy for relation "user_roles"
    not ok 5 - un CLIENT ne s'attribue aucun rôle par REST
        → auto-attribution de PARTENAIRE par un CLIENT : refus attendu (permission / RLS / objet inexistant), obtenu code=42P17 message=infinite recursion detected in policy for relation "user_roles"
not ok 1 - R10 — politiques de user_roles
# pass 0
# fail 5
```

Run 19 (après correctif) :

```text
    ok 1 - un compte authenticated lit ses propres rôles sans erreur 42P17
    ok 2 - un CLIENT ne lit pas les rôles des autres comptes
    ok 3 - un ADMIN lit les rôles des autres comptes
    ok 4 - un ADMIN ne s'attribue pas SUPERADMIN par REST
    ok 5 - un CLIENT ne s'attribue aucun rôle par REST
ok 1 - R10 — politiques de user_roles
# pass 5
# fail 0
```

### 1B.6 — Statut des comptes

**Grep de dépendance** (écritures `status: 'ACTIF'` des routes partenaire, routes sans contrôle d'identité) :

```text
$ grep -rn -E "status: .ACTIF." app/api/partner
app/api/partner/activation/route.ts:75:                        status: 'ACTIF',
app/api/partner/activation/route.ts:82:                    .update({ status: 'ACTIF', updated_at: new Date().toISOString() })
app/api/partner/activation/route.ts:104:                status: 'ACTIF',
app/api/partner/team/assignments/route.ts:122:                supabase.from('users').update({ role: 'CONTROLEUR', status: 'ACTIF', updated_at: new Date().toISOString() })
app/api/partner/team/assignments/route.ts:214:                .update({ status: 'ACTIF' })
app/api/partner/team/controller/[controllerId]/route.ts:115:                    status: 'ACTIF',
app/api/partner/team/controller/[controllerId]/route.ts:134:                status: 'ACTIF',
app/api/partner/team/controller/[controllerId]/route.ts:189:                newValue: { status: 'ACTIF', role: isExclusivelyInThisTeam ? 'CLIENT' : ctrlProfile?.role },
app/api/partner/team/invite/route.ts:196:                    status: 'ACTIF',
$ grep -rLn "getServerSessionUser\|getAuthenticatedUser" $(find app/api/partner app/api/tickets -name route.ts)
app/api/partner/activation/route.ts
app/api/partner/documents/upload/route.ts
app/api/partner/register/route.ts
app/api/tickets/route.ts
app/api/tickets/verify/route.ts
```

**Correctif.**
- `requireActiveSession(req)` (`lib/auth/session.ts`) : 401 sans session, 403 `ACCOUNT_NOT_ACTIVE` si `users.status` n'est pas ACTIF. Appliqué aux 60 appels de `getServerSessionUser` des 43 routes `/api/partner/*` et `/api/tickets/*` par un script de réécriture mécanique (même motif partout), puis à la main sur `metrics`, `documents/signed-url`, `activation`, `/api/tickets` et `/api/tickets/verify`. Exceptions publiques justifiées : `partner/register` et `partner/documents/upload` (inscription). Un contrôle statique vérifie la couverture.
- Invitation, affectation : un compte non ACTIF est refusé (409 `ACCOUNT_NOT_ACTIVE`), le refus est journalisé (`CONTROLLER_INVITE_REFUSED_INACTIVE`, `CONTROLLER_ASSIGNMENT_REFUSED_INACTIVE`, écriture vérifiée). Plus aucune écriture de `users.status` ni de `users.role` dans ces routes : le rôle passe par `user_roles` (`grantUserRoles`, erreurs remontées) et le trigger recalcule `users.role`. Retrait d'un contrôleur : statut inchangé.
- Les quatre routes du point 2 de l'en-tête.

**parcours/statut-compte**

Run 17 (avant correctif) :

```text
    not ok 1 - invitation d’un compte SUSPENDU par le partenaire A → refus explicite, journalisé, statut inchangé
        → refus explicite attendu, HTTP 201 {"success":true,"assignments":[{"id":"d1a3a47f-95f8-4df6-8817-1ddcd7dc6a65","event_id":"0016f200-9bfc-42f5-9f94-a387c21283fd","user_id":"bb5b5207-b0ca-44d9-b3d7-c49de95db699","can_accept_cash":false,"created_at":"2026-10-31T15:00:40.725627+00:00"}],"assignment":{"id
        → + undefined
        → - 'ACCOUNT_NOT_ACTIVE'
    not ok 2 - invitation avec l’email d’un compte existant et un autre numéro → refus, identifiants du compte intacts
        → refus attendu, HTTP 201 {"success":true,"assignments":[{"id":"ed8483eb-0729-49f1-9b8c-96ff2c8eb03d","event_id":"0016f200-9bfc-42f5-9f94-a387c21283fd","user_id":"60a031b1-c63f-40c1-91e5-e0fbd8c084f2","can_accept_cash":false,"created_at":"2026-10-31T15:00:41.089948+00:00"}],"assignment":{"id":"ed8483e
        → + undefined
        → - 'ACCOUNT_ALREADY_EXISTS'
    not ok 3 - affectation d’un compte SUSPENDU par le partenaire A → refus explicite, journalisé, statut inchangé
        → refus explicite attendu, HTTP 200 {"success":true,"message":"Affectations synchronisées avec succès.","added":["0016f200-9bfc-42f5-9f94-a387c21283fd"],"removed":[],"total_active":1}
        → + undefined
        → - 'ACCOUNT_NOT_ACTIVE'
    not ok 4 - retrait d’un contrôleur SUSPENDU par le partenaire A → retiré, statut inchangé
        → le retrait ne doit pas réactiver le compte
        → + 'ACTIF'
        → - 'SUSPENDU'
    not ok 5 - partenaire SUSPENDU → /api/partner/events refusé (ACCOUNT_NOT_ACTIVE)
        → HTTP 500 {"error":"Profil partenaire introuvable pour cet utilisateur."}
        → 500 !== 403
    not ok 6 - client SUSPENDU → /api/tickets/[id]/live-code refusé (ACCOUNT_NOT_ACTIVE)
        → HTTP 404 {"error":"Billet introuvable."}
        → 404 !== 403
    not ok 7 - activation d’essai d’un partenaire par un autre compte → refusée
        → HTTP 200 {"status":"VALIDE","success":true,"trial_ends_at":"2026-12-30T14:59:54.753+00:00","trial_started_at":"2026-10-31T14:59:54.753+00:00","is_new_activation":false}
        → 200 !== 403
    not ok 8 - liste des billets : le paramètre userId ne donne pas accès aux billets d’un autre compte
        → sans session : HTTP 200
        → 200 !== 401
    not ok 9 - vérification de billet : refusée à un CLIENT et au partenaire d’un autre événement, acceptée pour le contrôleur affecté
        → CLIENT : HTTP 200 {"status":"valid","message":"Accès autorisé ! Billet validé avec succès.","ticketInfo":{"ticketNumber":"TCK-VERIFY-7YA5LPLY","eventTitle":"TEST Concert A (publié, à venir)","holderName":"Birame ClientBis","category":"Standard","checkedInAt":"À l’instant"},"stats":{"checkedInCount":
        → 200 !== 403
    not ok 10 - toutes les routes /api/partner/* et /api/tickets/* passent par le helper commun
        → routes sans contrôle du statut du compte :
        → app/api/partner/activation/route.ts
        → app/api/partner/dashboard/route.ts
        → app/api/partner/documents/signed-url/route.ts
not ok 1 - Statut des comptes sur les routes partenaire et billets
# pass 0
# fail 10
```

Run 19 (après correctif) :

```text
    ok 1 - invitation d’un compte SUSPENDU par le partenaire A → refus explicite, journalisé, statut inchangé
    ok 2 - invitation avec l’email d’un compte existant et un autre numéro → refus, identifiants du compte intacts
    ok 3 - affectation d’un compte SUSPENDU par le partenaire A → refus explicite, journalisé, statut inchangé
    ok 4 - retrait d’un contrôleur SUSPENDU par le partenaire A → retiré, statut inchangé
    ok 5 - partenaire SUSPENDU → /api/partner/events refusé (ACCOUNT_NOT_ACTIVE)
    ok 6 - client SUSPENDU → /api/tickets/[id]/live-code refusé (ACCOUNT_NOT_ACTIVE)
    ok 7 - activation d’essai d’un partenaire par un autre compte → refusée
    ok 8 - liste des billets : le paramètre userId ne donne pas accès aux billets d’un autre compte
    ok 9 - vérification de billet : refusée à un CLIENT et au partenaire d’un autre événement, acceptée pour le contrôleur affecté
    ok 10 - toutes les routes /api/partner/* et /api/tickets/* passent par le helper commun
ok 1 - Statut des comptes sur les routes partenaire et billets
# pass 10
# fail 0
```

### 1B.7 — Codes OTP en base

**Grep de dépendance** :

```text
$ grep -rn "otp_codes\|otpMemoryCache" app lib | grep -v sensitive-action
app/api/auth/register/route.ts:6:import { otpMemoryCache } from '@/lib/sms/otp-cache';
app/api/auth/register/route.ts:52:        otpMemoryCache.set(normalizedPhone, { code: otpCode, expiresAt: otpExpiresAt, attempts: 0 });
app/api/auth/register/route.ts:150:            await (supabaseAdmin.from('otp_codes') as any).insert({
app/api/auth/register/route.ts:159:            console.warn('[API /api/auth/register] Impossible de persister otp_codes en DB:', dbErr instanceof Error ? dbErr.message : 
app/api/auth/send-otp/route.ts:7:import { otpMemoryCache } from '@/lib/sms/otp-cache';
app/api/auth/send-otp/route.ts:81:        otpMemoryCache.set(normalizedPhone, { code: otpCode, expiresAt, attempts: 0 });
app/api/auth/send-otp/route.ts:83:        // 3. Sauvegarde en base de données Supabase (si table otp_codes existante)
app/api/auth/send-otp/route.ts:85:            await (supabase.from('otp_codes') as any).insert({
app/api/auth/verify-otp/route.ts:4:import { otpMemoryCache } from '@/lib/sms/otp-cache';
app/api/auth/verify-otp/route.ts:49:        const cached = otpMemoryCache.get(normalizedPhone);
app/api/auth/verify-otp/route.ts:53:                otpMemoryCache.delete(normalizedPhone);
app/api/auth/verify-otp/route.ts:62:                otpMemoryCache.delete(normalizedPhone);
app/api/auth/verify-otp/route.ts:66:                    otpMemoryCache.delete(normalizedPhone);
app/api/auth/verify-otp/route.ts:75:        // 2. Vérification de secours dans la table PostgreSQL otp_codes si présent
app/api/auth/verify-otp/route.ts:79:                const { data: record } = await (supabase.from('otp_codes') as any)
app/api/auth/verify-otp/route.ts:91:                    await (supabase.from('otp_codes') as any)
app/api/auth/verify-otp/route.ts:96:                // Pas de table otp_codes
app/api/controller/setup/route.ts:5:import { otpMemoryCache } from '@/lib/sms/otp-cache';
app/api/controller/setup/route.ts:50:        const cached = otpMemoryCache.get(normalizedPhone);
app/api/controller/setup/route.ts:55:            const { data: dbOtp } = await (supabase.from('otp_codes') as any)
app/api/controller/setup/route.ts:155:        otpMemoryCache.set(normalizedPhone, { code: '', expiresAt: 0, attempts: 99 });
app/api/controller/setup/route.ts:157:            (supabase.from('otp_codes') as any)
app/api/partner/register/route.ts:9:import { otpMemoryCache } from '@/lib/sms/otp-cache';
app/api/partner/register/route.ts:63:        otpMemoryCache.set(normalizedPhone, { code: otpCode, expiresAt: otpExpiresAt, attempts: 0 });
app/api/partner/register/route.ts:171:            await (supabase.from('otp_codes') as any).insert({
app/api/partner/register/route.ts:179:            console.warn('[API /api/partner/register] Impossible de persister otp_codes en DB:', dbErr instanceof Error ? dbErr.mess
app/api/partner/team/controller/[controllerId]/route.ts:151:                    await supabase.from('otp_codes').delete().eq('phone', ctrlProfile.phone);
app/api/partner/team/controller/[controllerId]/route.ts:153:                    console.warn('[DELETE team/controller] otp_codes delete non-bloquant:', otpErr);
app/api/partner/team/invite/route.ts:9:import { otpMemoryCache } from '@/lib/sms/otp-cache';
app/api/partner/team/invite/route.ts:365:        otpMemoryCache.set(normalizedPhone, { code: otpCode, expiresAt, attempts: 0 });
app/api/partner/team/invite/route.ts:368:            await (supabase.from('otp_codes') as any).insert({
lib/admin/admin.service.ts:364:                await (supabase.from('otp_codes') as any)
lib/sms/otp-cache.ts:11:const globalForOtp = global as unknown as { otpMemoryCache: Map<string, OtpCacheEntry> };
lib/sms/otp-cache.ts:13:export const otpMemoryCache = globalForOtp.otpMemoryCache || new Map<string, OtpCacheEntry>();
lib/sms/otp-cache.ts:16:    globalForOtp.otpMemoryCache = otpMemoryCache;
```

**Correctif.** `lib/auth/otp-store.ts` : `storeOtp` (écriture vérifiée), `checkStoredOtp` (dernier code non consommé du numéro, expiration, 5 essais comptés en base), `consumeStoredOtp`, `verifyStoredOtp`. Les deux inscriptions, `send-otp` et l'invitation enregistrent le code **avant** l'envoi du SMS (plus de colonne `user_id`). `verify-otp` et `controller/setup` vérifient en base uniquement. `lib/sms/otp-cache.ts` est supprimé : plus aucun état OTP en mémoire de processus.

**parcours/otp-serveur**

Run 17 (avant correctif) :

```text
    ok 1 - send-otp → otp_codes → verify-otp depuis une autre instance
    not ok 2 - inscription client → otp_codes → verify-otp depuis une autre instance
        → le code envoyé au +221777449703 doit être persisté dans otp_codes
    not ok 3 - inscription partenaire → otp_codes → verify-otp depuis une autre instance
        → le code envoyé au +221781155249 doit être persisté dans otp_codes
not ok 1 - Parcours OTP serveur
# pass 1
# fail 2
```

Run 19 (après correctif) :

```text
    ok 1 - send-otp → otp_codes → verify-otp depuis une autre instance
    ok 2 - inscription client → otp_codes → verify-otp depuis une autre instance
    ok 3 - inscription partenaire → otp_codes → verify-otp depuis une autre instance
ok 1 - Parcours OTP serveur
# pass 3
# fail 0
```

### 1B.8 — Changement de rôle par un admin

**Grep de dépendance** :

```text
$ grep -rn "setUserRoles\|profile.role && !dbRoles" app lib
lib/auth/roles.ts:107:export async function setUserRoles(userId: string, roles: UserRoleType[]): Promise<{ error?: string }> {
lib/auth/session.ts:60:        if (profile.role && !dbRoles.includes(profile.role)) {
$ grep -rn -A3 "method: .PATCH." app/admin | grep -A3 "admin/users"
app/admin/dashboard/page.tsx-207-      const res = await fetch(`/api/admin/partners/${partner.id}/status`, {
app/admin/dashboard/page.tsx-210-        body: JSON.stringify({ status: 'VALIDE' }),
app/admin/dashboard/page.tsx-263-      const res = await fetch(`/api/admin/partners/${targetPartner.id}/status`, {
app/admin/dashboard/page.tsx-267-          status: 'REJETE',
app/admin/referral/page.tsx-73-
app/admin/referral/page.tsx-74-    try {
app/admin/referral/page.tsx-75-      const res = await fetch('/api/admin/users', {
app/admin/referral/page.tsx:76:        method: 'PATCH',
app/admin/referral/page.tsx-77-        headers: { 'Content-Type': 'application/json' },
app/admin/referral/page.tsx-78-        body: JSON.stringify({
app/admin/referral/page.tsx-79-          userId: user.id,
app/admin/referral/page.tsx-80-          referralStatus: newReferralStatus,
app/admin/referral/page.tsx-81-        }),
app/admin/referral/page.tsx-82-      });
app/admin/services/page.tsx-63-        body: JSON.stringify({ table, id, status: newStatus, reason }),
app/admin/users/page.tsx-137-    const newStatus = user.status === 'SUSPENDU' ? 'ACTIF' : 'SUSPENDU';
app/admin/users/page.tsx-138-    try {
app/admin/users/page.tsx-139-      const res = await fetch('/api/admin/users', {
app/admin/users/page.tsx:140:        method: 'PATCH',
app/admin/users/page.tsx-141-        headers: { 'Content-Type': 'application/json' },
app/admin/users/page.tsx-142-        body: JSON.stringify({
app/admin/users/page.tsx-143-          userId: user.id,
app/admin/users/page.tsx-144-          status: newStatus,
app/admin/users/page.tsx-145-        }),
app/admin/users/page.tsx-146-      });
```

L'interface admin n'envoie que `status` et `referralStatus` ; le contrat `role` de l'API est conservé.

**Correctif.** `PATCH /api/admin/users` accepte `roles` (ensemble exact) ou `role` (contrat historique, équivaut à `roles: [role]`), CLIENT toujours conservé. Écriture dans `user_roles` par `setUserRoles`, réécrit pour vérifier chaque ajout et chaque retrait ; plus d'écriture directe de `users.role`. Les protections SUPERADMIN reposent sur les rôles effectifs de l'acteur et de la cible. Journal `UPDATE_USER` avec rôles avant, après, ajoutés et retirés. `getServerSessionUser` n'ajoute plus `users.role` aux rôles lus dans `user_roles` (les routes accordaient un rôle que la RLS refusait) et lève une erreur si la lecture des rôles échoue.

**parcours/changement-role-admin**

Run 17 (avant correctif) :

```text
    not ok 1 - rôle CONTROLEUR retiré par PATCH → user_roles mis à jour, la RLS ne l’accorde plus
        → user_roles ne doit plus contenir CONTROLEUR
        → 'CLIENT',
        → +   'CONTROLEUR'
    not ok 2 - rôle CONTROLEUR ajouté par PATCH → user_roles et is_controller()
        → Expected values to be strictly deep-equal:
        → 'CLIENT',
        → -   'CONTROLEUR'
not ok 1 - Changement de rôle par un admin
# pass 0
# fail 2
```

Run 19 (après correctif) :

```text
    ok 1 - rôle CONTROLEUR retiré par PATCH → user_roles mis à jour, la RLS ne l’accorde plus
    ok 2 - rôle CONTROLEUR ajouté par PATCH → user_roles et is_controller()
ok 1 - Changement de rôle par un admin
# pass 2
# fail 0
```

### 1B.9 — Route de débogage et anonymisation

**Grep de dépendance** :

```text
$ grep -rn "test-notify-superadmins" app components lib hooks tests
app/api/test-notify-superadmins/route.ts:8: * GET /api/test-notify-superadmins
tests/parcours/anonymisation-debogage.test.ts:3: *  - Aucune route de test ou de débogage sous app/api (dont /api/test-notify-superadmins,
$ grep -n "phone: \`+000000" lib/admin/admin.service.ts
287:                phone: `+000000${targetUserId.replace(/-/g, '').slice(0, 6)}`,
```

**Correctif.** `/api/test-notify-superadmins` est supprimée : accessible à tout compte connecté sans contrôle de rôle, elle envoyait SMS et emails réels aux superadmins ; aucun appelant. Anonymisation : le téléphone synthétique `+000000…` était refusé par GoTrue. L'erreur, renvoyée et non levée, était ignorée : ni l'email, ni le téléphone, ni le bannissement n'étaient appliqués, le compte restait connectable. Numéro synthétique valide et unique (`+999…`, indicatif non attribué) ; un échec interrompt l'anonymisation. Les nettoyages qui suivent journalisent leurs erreurs au lieu de les ignorer.

**parcours/anonymisation-debogage**

Run 17 (avant correctif) :

```text
    not ok 1 - aucune route de test ou de débogage sous app/api
        → routes de débogage présentes :
        → app/api/test-notify-superadmins
        → +   'app/api/test-notify-superadmins'
        → - []
    not ok 2 - compte anonymisé : email et téléphone de connexion brouillés, connexion impossible, email libéré
        → auth.users.email doit être brouillé
not ok 1 - Routes de débogage et anonymisation
# pass 0
# fail 2
```

Run 19 (après correctif) :

```text
    ok 1 - aucune route de test ou de débogage sous app/api
    ok 2 - compte anonymisé : email et téléphone de connexion brouillés, connexion impossible, email libéré
ok 1 - Routes de débogage et anonymisation
# pass 2
# fail 0
```

---

## 3. Choix de 1B.1 : lecture en base dans le middleware

**Choix : lecture de `public.user_roles` dans le middleware**, avec la session de l'utilisateur, plutôt qu'une copie des rôles dans `raw_app_meta_data`.

- **Fraîcheur.** Les deux options sont immédiates ici : le middleware appelle déjà `supabase.auth.getUser()`, qui relit l'utilisateur chez GoTrue à chaque requête. Le délai d'un JWT à rafraîchir (une heure) ne s'appliquerait qu'à un middleware qui lirait les claims du jeton sans appel réseau. La lecture en base reste immédiate dans tous les cas (test `roles-fraicheur` : promotion et retrait suivis par la même session, sans reconnexion).
- **Coût.** Une requête PostgREST indexée par navigation, **uniquement** sur `/admin`, `/partner`, `/controller`, `/scan` et les pages d'authentification ; aucune sur les pages publiques. Elle s'ajoute à l'appel `getUser()` déjà présent.
- **Source unique.** `user_roles` est déjà la source de la RLS (`has_role`) et des routes serveur (`getServerSessionUser`). Une copie dans `app_metadata` serait une troisième représentation à garder synchrone, et dépendrait du comportement de GoTrue à l'inscription. Au lot 1A, GoTrue réécrivait les métadonnées après les triggers de `admin.createUser`.
- **Sans repli.** Si la lecture échoue, l'accès est refusé et l'erreur journalisée.

---

## 4. Suites legacy réécrites ou supprimées

Les suites de `tests/legacy` ne tournent pas : elles visent l'ancien projet distant, abandonné, avec des UUID codés en dur. Repérage des suites qui ouvrent un client anon ou appellent une route ou un comportement modifié par ce lot (arbre du commit `49d41a5`) :

```text
$ for f in tests/legacy/*.ts; do …   (client anon ouvert, routes et comportements modifiés par le lot 1B)
admin-anonymize.test.ts | anon=0 | anonymizeUser 
camera-qr-scanner.test.ts | anon=0 | tickets/verify 
cdc-v3-validation-checks.test.ts | anon=1 | 
checkout-mixed-cart.test.ts | anon=1 | 
chunk5-phase2-b2c.test.ts | anon=0 | tickets/verify 
client-ticket-lifecycle.test.ts | anon=1 | api/tickets? api/tickets` 
controller-14-points.test.ts | anon=1 | team/assignments team/controller team/invite 
controller-complete-workflow.test.ts | anon=1 | 
controller-event-status-hotfix.test.ts | anon=1 | team/assignments team/invite 
controller-multi-role.test.ts | anon=1 | team/controller team/invite user_metadata?.role 
controller-realtime-sync.test.ts | anon=1 | team/assignments team/controller 
controller-shifts-z.test.ts | anon=1 | team/controller 
dynamic-qr-totp.test.ts | anon=1 | tickets/verify 
hold-cart-stock.test.ts | anon=1 | 
partner-events-m5.test.ts | anon=1 | 
partner-tables-m8.test.ts | anon=1 | 
scanner-security-hardening.test.ts | anon=1 | team/invite 
security-fixes.test.ts | anon=1 | team/assignments team/controller team/invite 
ticket-pdf-and-exports.test.ts | anon=1 | 
ticket-scanned-notifications.test.ts | anon=1 | api/tickets? tickets/verify 
ticket-stock-lifecycle.test.ts | anon=1 | api/tickets' 
ticket-transfer-phase2-initiation.test.ts | anon=1 | 
ticket-transfer-phase3-claim.test.ts | anon=1 | 
ticket-transfers-phase1-schema.test.ts | anon=3 | 
ticketing-e2e-final.test.ts | anon=1 | 

$ grep -n "tickets/verify\|api/tickets?userId\|user_metadata?.role\|startsWith(.+000000" (assertions et appels concernés)
admin-anonymize.test.ts:244:                    !authUserRecord.user.phone || authUserRecord.user.phone === '' || authUserRecord.user.phone.startsWith('+000000') || authU
camera-qr-scanner.test.ts:147:        const req = new NextRequest('http://localhost:3000/api/tickets/verify', {
chunk5-phase2-b2c.test.ts:337:        const req1 = new NextRequest('http://localhost:3000/api/tickets/verify', {
chunk5-phase2-b2c.test.ts:354:        const req2 = new NextRequest('http://localhost:3000/api/tickets/verify', {
chunk5-phase2-b2c.test.ts:364:        const req3 = new NextRequest('http://localhost:3000/api/tickets/verify', {
controller-multi-role.test.ts:267:        assert.equal(authUser.user?.user_metadata?.role, 'CONTROLEUR', 'Auth metadata mis à jour à CONTROLEUR');
controller-multi-role.test.ts:350:        assert.equal(authUserAfterDelete.user?.user_metadata?.role, 'CLIENT', 'Auth metadata rétrogradé à CLIENT');
dynamic-qr-totp.test.ts:438:        const verifyReq = new NextRequest('http://localhost:3000/api/tickets/verify', {
dynamic-qr-totp.test.ts:456:        const expReq = new NextRequest('http://localhost:3000/api/tickets/verify', {
ticket-scanned-notifications.test.ts:132:        const req = new NextRequest(`http://localhost/api/tickets?userId=${buyerUserId}`);
ticket-scanned-notifications.test.ts:192:        const req = new NextRequest(`http://localhost/api/tickets?userId=${buyerUserId}`);
ticket-scanned-notifications.test.ts:205:        const verifyReq = new NextRequest('http://localhost/api/tickets/verify', {
```

Les clients anon de ces suites servent à ouvrir des sessions ; toutes leurs écritures passent par le service_role et ne sont pas touchées par les nouvelles politiques. Décisions :

| Suite | Décision | Justification |
|---|---|---|
| `controller-multi-role` | réécrite (2 assertions) | `user_metadata.role` n'est plus écrit (1B.1) : vérification dans `user_roles` |
| `dynamic-qr-totp` (cas 7) | réécrite | `/api/tickets/verify` exige une session (1B.6) : jeton du partenaire propriétaire de l'événement |
| `ticket-scanned-notifications` (cas 4) | réécrite | même motif : jeton du contrôleur affecté à l'événement de test |
| `ticket-scanned-notifications` (cas 1 et 3) | cas supprimés | lisaient `/api/tickets?userId=…` sans session, la faille corrigée ; mot de passe du compte distant absent du dépôt ; refus couvert par `parcours/statut-compte` |
| `camera-qr-scanner` (cas 2) | cas supprimé | vérification sans session ; couvert par `parcours/statut-compte` (contrôleur affecté → valide et composté) |
| `chunk5-phase2-b2c` (cas 7) | cas supprimé | même motif |
| `admin-anonymize` | réécrite (1 assertion) | numéro synthétique `+999…` (1B.9) ; l'ancien `+000000…` était refusé par GoTrue |
| autres suites listées | inchangées | appellent les routes modifiées avec des comptes ACTIF, des sessions du bon compte, ou n'ouvrent un client anon que pour se connecter |

---

## 5. Sortie brute de `npm run verify` et CI

Run de référence : **https://github.com/fallouu-mn/event-village/actions/runs/41213878715** (run 19, commit `999bc59`). Sortie complète : `docs/lot1b-logs/ci-run19-verify.log`.

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

[run-tests] 38 suite(s) — garde-fou : tests/helpers/env.ts — délai/suite : 600.0s
[… 2202 lignes de sortie des suites, intégralement dans docs/lot1b-logs/ci-run19-verify.log …]
═══════════════════ RÉCAPITULATIF ═══════════════════
Suite                                           Statut   Durée     Code  Journal
tests/auth-rbac.test.ts                         PASS     233ms     0     .test-logs/tests__auth-rbac.test.ts.log
tests/e2e-scenarios.test.ts                     PASS     390ms     0     .test-logs/tests__e2e-scenarios.test.ts.log
tests/fondations-lot0.test.ts                   PASS     376ms     0     .test-logs/tests__fondations-lot0.test.ts.log
tests/notifications-and-documents.test.ts       PASS     195ms     0     .test-logs/tests__notifications-and-documents.test.ts.log
tests/parcours/achat-serveur.test.ts            PASS     577ms     0     .test-logs/tests__parcours__achat-serveur.test.ts.log
tests/parcours/anonymisation-debogage.test.ts   PASS     658ms     0     .test-logs/tests__parcours__anonymisation-debogage.test.ts.log
tests/parcours/attribution-roles.test.ts        PASS     982ms     0     .test-logs/tests__parcours__attribution-roles.test.ts.log
tests/parcours/bootstrap-superadmin.test.ts     PASS     528ms     0     .test-logs/tests__parcours__bootstrap-superadmin.test.ts.log
tests/parcours/changement-role-admin.test.ts    PASS     905ms     0     .test-logs/tests__parcours__changement-role-admin.test.ts.log
tests/parcours/otp-serveur.test.ts              PASS     664ms     0     .test-logs/tests__parcours__otp-serveur.test.ts.log
tests/parcours/pin-regisseur.test.ts            PASS     394ms     0     .test-logs/tests__parcours__pin-regisseur.test.ts.log
tests/parcours/realtime-scanner.test.ts         PASS     16.2s     0     .test-logs/tests__parcours__realtime-scanner.test.ts.log
tests/parcours/roles-fraicheur.test.ts          PASS     898ms     0     .test-logs/tests__parcours__roles-fraicheur.test.ts.log
tests/parcours/statut-compte.test.ts            PASS     2.0s      0     .test-logs/tests__parcours__statut-compte.test.ts.log
tests/partner-auth-complete.test.ts             PASS     389ms     0     .test-logs/tests__partner-auth-complete.test.ts.log
tests/partner-halls-m7.test.ts                  PASS     1.1s      0     .test-logs/tests__partner-halls-m7.test.ts.log
tests/partner-orders-m9.test.ts                 PASS     1.2s      0     .test-logs/tests__partner-orders-m9.test.ts.log
tests/payment.test.ts                           PASS     189ms     0     .test-logs/tests__payment.test.ts.log
tests/roles-isolation.test.ts                   PASS     176ms     0     .test-logs/tests__roles-isolation.test.ts.log
tests/scanner-combat-ui.test.ts                 PASS     343ms     0     .test-logs/tests__scanner-combat-ui.test.ts.log
tests/scanner-wolof-audio.test.ts               PASS     329ms     0     .test-logs/tests__scanner-wolof-audio.test.ts.log
tests/schema/fonctions-privileges.test.ts       PASS     260ms     0     .test-logs/tests__schema__fonctions-privileges.test.ts.log
tests/schema/hotfix-identique.test.ts           PASS     183ms     0     .test-logs/tests__schema__hotfix-identique.test.ts.log
tests/schema/hotfix-scripts.test.ts             PASS     333ms     0     .test-logs/tests__schema__hotfix-scripts.test.ts.log
tests/schema/rls-toutes-tables.test.ts          PASS     211ms     0     .test-logs/tests__schema__rls-toutes-tables.test.ts.log
tests/security/anon-uniquement.test.ts          PASS     184ms     0     .test-logs/tests__security__anon-uniquement.test.ts.log
tests/security/r1-inscription-roles.test.ts     PASS     1.2s      0     .test-logs/tests__security__r1-inscription-roles.test.ts.log
tests/security/r10-user-roles.test.ts           PASS     558ms     0     .test-logs/tests__security__r10-user-roles.test.ts.log
tests/security/r2-otp-codes.test.ts             PASS     392ms     0     .test-logs/tests__security__r2-otp-codes.test.ts.log
tests/security/r3-fonctions-rpc.test.ts         PASS     484ms     0     .test-logs/tests__security__r3-fonctions-rpc.test.ts.log
tests/security/r4-ecritures-directes.test.ts    PASS     499ms     0     .test-logs/tests__security__r4-ecritures-directes.test.ts.log
tests/security/r5-lectures-anon.test.ts         PASS     427ms     0     .test-logs/tests__security__r5-lectures-anon.test.ts.log
tests/security/r6-roles-jeton.test.ts           PASS     602ms     0     .test-logs/tests__security__r6-roles-jeton.test.ts.log
tests/security/r7-profil-colonnes.test.ts       PASS     703ms     0     .test-logs/tests__security__r7-profil-colonnes.test.ts.log
tests/security/r8-controleur-lectures.test.ts   PASS     438ms     0     .test-logs/tests__security__r8-controleur-lectures.test.ts.log
tests/security/r9-partenaire-ecritures.test.ts  PASS     450ms     0     .test-logs/tests__security__r9-partenaire-ecritures.test.ts.log
tests/superadmin-complete.test.ts               PASS     307ms     0     .test-logs/tests__superadmin-complete.test.ts.log
tests/ux-performance-and-double-click.test.ts   PASS     621ms     0     .test-logs/tests__ux-performance-and-double-click.test.ts.log
──────────────────────────────────────────────────────
TOTAL : 38 suite(s) — 38 réussie(s), 0 en échec, 0 expirée(s)

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
    at c (/home/runner/work/event-village/event-village/.next/server/app/api/checkout/route.js:1:7874)
    at l (/home/runner/work/event-village/event-village/.next/server/app/api/checkout/route.js:1:7401)
    at c (/home/runner/work/event-village/event-village/.next/server/app/api/partner/orders/route.js:1:568)
    at /home/runner/work/event-village/event-village/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:38417
    at /home/runner/work/event-village/event-village/node_modules/next/dist/server/lib/trace/tracer.js:140:36
    at NoopContextManager.with (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:7062)
    at ContextAPI.with (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:518) {
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
├ ƒ /halls/[id]                                         5.72 kB         191 kB
├ ○ /login                                              10.4 kB         196 kB
├ ○ /notifications                                      5.92 kB         178 kB
├ ○ /orders                                             6.04 kB         178 kB
├ ○ /partner                                            177 B          87.8 kB
├ ○ /partner/calendar                                   4.53 kB         108 kB
├ ○ /partner/dashboard                                  13.4 kB         186 kB
├ ○ /partner/events                                     6.85 kB         122 kB
├ ƒ /partner/events/[id]/caisse                         6.97 kB         115 kB
├ ƒ /partner/events/[id]/edit                           6.66 kB         128 kB
├ ƒ /partner/events/[id]/team                           5.09 kB         182 kB
├ ○ /partner/events/new                                 9.57 kB         131 kB
├ ○ /partner/finance                                    4.84 kB         198 kB
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
├ ○ /profile                                            6.95 kB         179 kB
├ ○ /register                                           9.08 kB         194 kB
├ ○ /reset-password                                     7.65 kB         180 kB
├ ƒ /restaurants/[id]/menu                              4.91 kB         190 kB
├ ƒ /restaurants/[id]/tables                            5.27 kB         191 kB
├ ○ /scan                                               177 B          87.8 kB
├ ○ /tickets                                            16.1 kB         238 kB
├ ƒ /tickets/claim/[token]                              4.58 kB         227 kB
└ ○ /wallet                                             8.57 kB         172 kB
+ First Load JS shared by all                           87.6 kB
  ├ chunks/2117-488d789e9004e22c.js                     31.9 kB
  ├ chunks/fd9d1056-270721ac51469ce4.js                 53.6 kB
  └ other shared chunks (total)                         2.1 kB


ƒ Middleware                                            87.1 kB

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand


[verify] OK — 4 étapes réussies en 97s.
```

| Run | Commit | Résultat | Rôle |
|---|---|---|---|
| [15 · 41211487810](https://github.com/fallouu-mn/event-village/actions/runs/41211487810) | 131a85a | échec attendu | premiers tests rouges : 11 suites en échec sur 38, dont `partner-halls-m7` (instabilité, voir section 1) |
| [16 · 41212116429](https://github.com/fallouu-mn/event-village/actions/runs/41212116429) | 9d9c0f9 | échec attendu | tests corrigés (R6, R9, vérification de billet, SMS OTP) : 10 en échec |
| [17 · 41212525502](https://github.com/fallouu-mn/event-village/actions/runs/41212525502) | 49d41a5 | échec attendu | **référence « avant »** : tests finals, aucun correctif ; 10 en échec |
| [18 · 41213251086](https://github.com/fallouu-mn/event-village/actions/runs/41213251086) | 106615e | échec | correctifs : 36 sur 38 ; R6 (commentaire citant la fonction supprimée), R8 (`02-hotfix.sql` rétablissait la politique du lot 1A) |
| [19 · 41213878715](https://github.com/fallouu-mn/event-village/actions/runs/41213878715) | 999bc59 | succès | **référence « après »** : 38 suites vertes sur 38 |

---

## 6. Points ouverts

### Sécurité, hors périmètre du lot 1B

1. **Invitation : identité des comptes existants.** Pour un compte trouvé par son numéro, l'invitation écrase encore `first_name`, `last_name` et `email` avec la saisie du partenaire. La recherche par numéro accepte un suffixe de 9 chiffres (`ilike %…`), et les filtres `.or()` sont construits avec la saisie brute du téléphone.
2. **Documents d'inscription.** `/api/partner/documents/signed-url` délivre une URL signée de tout fichier `pending_registrations/…` ou `temp_…` à n'importe quel compte connecté qui en connaît le chemin (pièces d'identité, RCCM).
3. **`auth.admin.signOut(userId)`** est appelé avec un identifiant au lieu d'un jeton (invitation, affectation, retrait de contrôleur) : sans effet. Après un retrait de rôle, les accès suivent quand même, puisque middleware, routes et RLS lisent `user_roles`. Après anonymisation, le bannissement empêche toute nouvelle session ; un jeton d'accès déjà émis reste valable jusqu'à son expiration (une heure au plus).
4. **Changement de téléphone ou d'email** : bloqué par REST (1B.2) ; route serveur avec OTP (§153) à créer quand l'interface le proposera.
5. **Codes OTP stockés en clair** dans `otp_codes` (table fermée aux rôles API depuis le lot 1A) ; limitation des essais de `RateLimiter` en partie en mémoire de processus.
6. **Copie des rôles dans `raw_user_meta_data`** par `sync_user_roles_to_jwt` : plus lue nulle part ; à retirer, ou à basculer vers `raw_app_meta_data`, une fois le script de détection du lot 1A sans usage.
7. **Mots de passe codés en dur** dans `scratch/` et `tests/legacy/` (signalés après le lot 1A) : toujours présents dans la branche.

Le lot 2 n'a pas été commencé.
