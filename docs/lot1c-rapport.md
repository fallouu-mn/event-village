# LOT 1C — RAPPORT

**Objet :** sécurité résiduelle (points ouverts n° 1 à 7 du lot 1B), puis complément « canaux de notification » (1C.8, 1C.9).
**Branche :** `fix/evenementiel`. Aucun push sur `main`. Rien n'a été exécuté contre le projet Supabase distant. Aucun script de hotfix : tout passe par des migrations du dépôt, appliquées et testées en CI (`supabase db reset`).
**Date :** 31 octobre 2026.

**Résultat :** les neuf tâches sont traitées (1C.7 : constat documenté, sans modification du module des salles). Chaque défaut est prouvé par un test qui échoue sur le code d'avant correctif (run CI 22, commit `17ce0b2`) et passe après (run 25, commit `695af3d`). `npm run verify` est vert, 49 suites sur 49 : https://github.com/fallouu-mn/event-village/actions/runs/41223947446. Deux reprises du correctif 1C.2 ont été nécessaires après les runs 23 et 24 (sections 1 et 6).

---

## À lire en premier

1. **Contrats d'API modifiés (à connaître pour le front et le client).**
   - **Invitation d'un contrôleur** (`/api/partner/team/invite`) : l'email saisi par le partenaire n'est plus utilisé. Un compte neuf reçoit un email de connexion synthétique `<chiffres du numéro>@eventvillage.sn` ; c'est ce qui coupe la prise de contrôle par « mot de passe oublié » (1C.1). Pour un compte existant, la réponse ne contient plus qu'un nom masqué (`Fa*** N***`) et le numéro saisi, plus l'identifiant, le rôle ni le nom en clair ; le code d'activation n'est plus jamais renvoyé au partenaire. Le cas du lot 1B « email d'un compte existant + autre numéro » crée donc désormais un compte distinct au lieu d'un refus (test 1B adapté, section 1).
   - **Pièces d'inscription partenaire** (1C.2) : `/api/partner/documents/upload` renvoie un `uploadToken` ; `/api/partner/register` attend `idCardUploadToken` / `businessDocUploadToken` (plus `idCardUrl` / `businessDocUrl`) ; `/api/partner/documents/signed-url?path=…` est refusé (400), remplacé par `?partnerId=…&docType=id_card|business_doc` ou `?uploadToken=…`. La page d'inscription et le tableau de bord admin sont mis à jour dans le même commit.
   - **Hook SMS de Supabase Auth** (1C.9) : sans `SUPABASE_AUTH_HOOK_SECRET`, il refuse tout appel (503) au lieu de relayer sans contrôle.
   - **Email** (1C.8) : sans `RESEND_API_KEY`, aucun email n'est tenté ; un avertissement unique au démarrage.
2. **Variables d'environnement désormais obligatoires** : `OTP_HASH_SECRET` (nouvelle, 32 caractères au moins, dédiée) et `MTARGET_USERNAME` / `MTARGET_PASSWORD`. Sans elles, les routes serveur refusent de démarrer (`lib/env.ts`). Le `.env.test` local antérieur au lot ne contient pas `OTP_HASH_SECRET` : le recopier depuis `.env.test.example` (la CI le génère depuis ce fichier). Même chose pour tout `.env.local` de développement.
3. **Secrets retirés de la branche, mais présents dans l'historique Git d'un dépôt public** (section 4) : mots de passe des comptes du projet de test distant, dont celui du compte superadmin `superadmin@eventvillage.sn`. Ils doivent être considérés comme publics : rotation ou abandon du projet de test distant, comme recommandé depuis le lot 1A.
4. **1C.7 (constat, aucun code modifié)** : aucune partie de l'application ne traite l'erreur 40P01. Le test `partner-halls-m7` passe par un service que la production n'utilise pas ; la route de production renverrait un 500 générique au lieu d'un 409 (section 2, 1C.7).

---

## 1. Commits

| Commit | Message |
|---|---|
| ab6ceb2 | test(securite)[1C.1]: invitation sans modification d'un compte existant (nom masqué, recherche E.164 exacte, resend, code non renvoyé) ; filtres PostgREST interpolés |
| cf68390 | test(securite)[1C.2]: documents d'inscription (chemin aléatoire, jeton de dépôt, URL signée propriétaire/admin/jeton, 403 tiers) et Storage fermé à anon et aux comptes tiers |
| b9a9ac4 | test(securite)[1C.3]: le jeton de rafraîchissement ne donne plus de session après retrait de rôle, suspension, anonymisation ou déconnexion globale |
| 727b8d4 | test(securite)[1C.4]: aucun code OTP en clair en base, OTP_HASH_SECRET obligatoire ; R2 exige un refus de privilège (42501) |
| cd20ca9 | test(roles)[1C.5]: aucun rôle dans raw_user_meta_data (trigger, fixtures, attribution serveur) ; has_role à la place des rôles du jeton |
| 75cbe80 | test(securite)[1C.6]: plus de scratch/, de mot de passe littéral dans tests/ et scripts/, ni de secret de repli dans le code serveur |
| cc85892 | test(notifications)[1C.8]: inscriptions et achat sans RESEND_API_KEY (aucun email tenté, un seul avertissement), MTarget obligatoire |
| 7735a95 | test(securite)[1C.9]: anti-abus SMS (rafale par numéro, limite par IP, plafond global avec alerte, fail-closed, numéro déjà inscrit, hook SMS) |
| 17ce0b2 | test(securite)[1C.9]: le test fail-closed ferme toujours sa connexion pg (run 21 expiré à 600 s sur la base rouge) |
| 2736572 | fix(securite)[1C.1]: invitation par égalité E.164 exacte, compte existant jamais modifié, filtres PostgREST assainis |
| 6411086 | fix(securite)[1C.3]: déconnexion forcée réelle (sessions et jetons de rafraîchissement révoqués en base) |
| cd5116b | fix(securite)[1C.4]: codes OTP hachés (HMAC-SHA256, OTP_HASH_SECRET obligatoire), comparaison en temps constant |
| ef63d9d | fix(roles)[1C.5]: sync_user_roles_to_jwt ne recopie plus les rôles dans les métadonnées ; clés role/roles retirées |
| 38e742a | fix(securite)[1C.6]: plus de scratch/, de mot de passe littéral dans tests/ ni de secret de repli dans le code serveur |
| c7d5bb8 | feat(notifications)[1C.8]: email (Resend) optionnel, SMS (MTarget) obligatoire |
| ca72332 | fix(securite)[1C.9]: anti-abus SMS — compteurs en base, limites par numéro, par IP et plafond global, fail-closed |
| 4b3bebe | fix(securite)[1C.2]: pièces d'inscription — chemins non devinables, jetons de dépôt, URL signée au propriétaire et à l'admin seulement |
| f73ce86 | fix(securite)[1C.2]: URL signée accessible au titulaire d'un dossier en attente de validation (run 23) |
| 695af3d | fix(securite)[1C.2]: signed-url repasse par requireActiveSession, avec allowStatuses ACTIF + EN_ATTENTE (run 24) |

Ce rapport est ajouté par le commit qui suit le dernier de cette liste.

**Ordre des commits de correctifs.** 1C.9 est committé avant 1C.2 : le dépôt public de pièces (1C.2) utilise l'infrastructure de quotas en base et la lecture de l'IP cliente créées pour l'anti-abus SMS (1C.9). Les fichiers partagés entre tâches (`lib/env.ts`, `.env.example`, `.env.test.example`, `docs/deploiement-projet-neuf.md`, `app/api/partner/register/route.ts`, `lib/notifications/notification.service.ts`, `app/api/partner/team/assignments/route.ts`, `app/api/admin/users/route.ts`, `lib/admin/admin.service.ts`, `lib/validations/auth.ts`, `tests/partner-auth-complete.test.ts`) ont été découpés ligne par ligne : chaque commit ne contient que les lignes de sa tâche, et le dernier commit reproduit exactement l'arbre de travail vérifié.

### Règles de test appliquées

- Tests de sécurité (`tests/security/r2`, `r11`) : clé anon, `signUp` et `signInWithPassword` uniquement ; `anon-uniquement.test.ts` reste vert.
- Tests de parcours (`tests/parcours`) : routes appelées directement, préparation des comptes par le service_role. Le test fail-closed de 1C.9 retire temporairement à `service_role` le droit EXECUTE sur `quota_reserve` par une connexion Postgres locale (hôte vérifié local), puis le rend.
- Faux adaptateurs SMS, email et paiement (`EV_INTEGRATIONS=fake`) : aucun appel réseau vers MTarget, Resend ou SamirPay.

### Tests modifiés (signalement)

- **`tests/parcours/statut-compte.test.ts`** (lot 1B) : le cas « invitation avec l'email d'un compte existant et un autre numéro » attendait un refus (409). Avec 1C.1, l'email saisi est ignoré : la route crée un compte distinct. Le cas vérifie désormais un compte créé différent de la victime, un email de connexion différent du sien et les identifiants de la victime intacts. Contrat changé volontairement (point 1 ci-dessus). Modifié dans le commit 1C.1.
- **`tests/parcours/sms-anti-abus.test.ts`** :
  - après le run 21, la connexion Postgres du test fail-closed est fermée même si la restauration du droit échoue. Sur la base rouge, `quota_reserve` n'existait pas : le `GRANT` levait avant `db.end()`, le processus de test ne se terminait pas (TIMEOUT à 600 s). Assertions inchangées (commit `17ce0b2`, run 22 propre) ;
  - deux cas ajoutés **après** le run rouge, dans le commit 1C.9 : signature Standard Webhooks valide relayée (non-régression du hook réel) et horodatage périmé refusé (rejeu). Ils n'ont pas été exécutés sur l'ancienne base : l'ancien code ne contrôlait pas l'horodatage, le second y aurait donc échoué (déduit du code, non exécuté).
- **`tests/parcours/documents-inscription.test.ts`** : un cas ajouté **après** le run rouge, dans le commit 1C.2 : un dossier antérieur au lot (chemin hérité `pending_registrations/…` dans `partners`) reste consultable par l'admin, pas par le propriétaire. Non-régression du repli ajouté en relisant le correctif.
- **`tests/notifications-and-documents.test.ts`** (contrôle statique du tableau de bord admin, antérieur au lot) : l'assertion « un bouton d'ouverture par pièce » cherchait `handleViewDocument(selectedPartner.id_card_url` ; le bouton demande désormais l'URL par dossier et type de pièce (contrat 1C.2). Elle cherche `handleViewDocument(selectedPartner.id, 'id_card'` (et `'business_doc'`). Rouge au run 23, adaptée dans le commit `f73ce86` ; l'intention (un bouton par pièce, ouverture `noopener,noreferrer`, appel de `signed-url`) est inchangée.
- **`tests/partner-auth-complete.test.ts`** : schéma d'inscription avec jetons de dépôt (1C.2), import du service supprimé retiré (1C.4), `TEST_PASSWORD` au lieu d'un littéral (1C.6).
- **`tests/partner-halls-m7.test.ts`, `tests/partner-orders-m9.test.ts`, `tests/ux-performance-and-double-click.test.ts`** : `TEST_PASSWORD` au lieu d'un littéral (1C.6). Aucune assertion modifiée.
- **Commits rouges du lot qui touchent des tests existants :**
  - `tests/parcours/otp-serveur.test.ts` (727b8d4) : la vérification « code non consommé » lit la dernière ligne du numéro sans sélectionner la colonne `code`, qui disparaît ;
  - `tests/security/r2-otp-codes.test.ts` (727b8d4) : exige désormais un refus de privilège (42501) et n'insère plus de colonne `code` ; vert avant et après correctif (garde-fou) ;
  - `tests/parcours/attribution-roles.test.ts` (cd20ca9) : le rôle de session est lu par `has_role` et les métadonnées ne doivent plus porter de rôle ;
  - `tests/schema/hotfix-scripts.test.ts` (cd20ca9) : métadonnées d'inscription explicites pour les cas qui en dépendent ; vert avant et après ;
  - `tests/helpers` et `tests/parcours/helpers.ts` (cf68390) : dépôt de pièces réel (PDF minimal) et jetons.
- **`tests/legacy/mtarget-sms.test.ts` supprimé**, ses cas de formatage repris dans `tests/sms-formatage.test.ts` (section 5).

---

## 2. Tâches : grep, test rouge, correctif, test vert

Avant correctif : run CI 22 (`41220786082`, commit `17ce0b2`), tests dans leur version finale (sauf les trois cas ajoutés après, signalés en section 1), aucun correctif appliqué. Après : run 25 (`41223947446`, commit `695af3d`). Les greps sont exécutés sur l'arbre du commit `17ce0b2` (`git grep … 17ce0b2`). Journaux bruts complets sur la branche `ci-results` (`runs/22-41220786082/`, `runs/25-41223947446/`).

Suites vertes avant et après : `statut-compte`, `partner-auth-complete`, `r2-otp-codes`, `otp-serveur`, `hotfix-scripts`. Ce sont des garde-fous de non-régression, pas des preuves de défaut. `statut-compte` et `partner-auth-complete` tournaient au run 22 dans leur version d'avant le lot, puisqu'elles ont été adaptées dans les commits de correctif (section 1). La preuve des défauts correspondants est portée par `invitation-identite` et `documents-inscription`.

### 1C.1 — Invitation et filtres construits par interpolation

**Grep de dépendance** :

```text
$ git grep -n -E '\.or\(`' 17ce0b2 -- app lib components hooks middleware.ts
17ce0b2:app/api/admin/users/route.ts:52:            query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
17ce0b2:app/api/controller/setup/route.ts:69:            .or(`phone.eq.${normalizedPhone},phone.eq.${phone.trim()},phone.ilike.%${suffix9}`)
17ce0b2:app/api/partner/team/invite/route.ts:149:            .or(`phone.eq.${normalizedPhone},phone.eq.${phone.trim()},phone.ilike.%${suffix9}`)
17ce0b2:app/api/payments/[transactionId]/status/route.ts:27:            .or(`transaction_id.eq.${transactionId},external_order_id.eq.${transactionId}`)
17ce0b2:app/api/restaurants/[id]/menu/route.ts:32:                .or(`commercial_name.ilike.%${cleanSlug}%,company_name.ilike.%${cleanSlug}%`)
17ce0b2:app/api/restaurants/[id]/tables/route.ts:32:                .or(`commercial_name.ilike.%${cleanSlug}%,company_name.ilike.%${cleanSlug}%`)
17ce0b2:lib/admin/admin.service.ts:366:                    .or(`phone.eq.${originalPhone},phone.eq.${originalPhone.replace('+', '')},phone.eq.${anonymizedPhone}`)
17ce0b2:lib/payments/payment.service.ts:500:            .or(`external_order_id.eq.${order_id},transaction_id.eq.${order_id}`)
(code de sortie 0)

$ git grep -n -E '\.(i?like)\([^)]*`' 17ce0b2 -- app lib components hooks middleware.ts
17ce0b2:lib/events/event.service.ts:201:            query = query.ilike('title', `%${options.search.trim()}%`);
(code de sortie 0)

$ git grep -n -E 'phone\.ilike|suffix9' 17ce0b2 -- app lib components hooks middleware.ts
17ce0b2:app/api/admin/users/route.ts:52:            query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
17ce0b2:app/api/controller/setup/route.ts:64:        const suffix9 = rawDigits.slice(-9);
17ce0b2:app/api/controller/setup/route.ts:69:            .or(`phone.eq.${normalizedPhone},phone.eq.${phone.trim()},phone.ilike.%${suffix9}`)
17ce0b2:app/api/partner/team/invite/route.ts:144:        const suffix9 = rawDigits.slice(-9);
17ce0b2:app/api/partner/team/invite/route.ts:149:            .or(`phone.eq.${normalizedPhone},phone.eq.${phone.trim()},phone.ilike.%${suffix9}`)
(code de sortie 0)
```

L'inventaire complet des filtres, avec la classification de chaque valeur, est en section 3.

**Correctif.**
- `lib/validations/auth.ts` : `toSenegaleseE164` (mobile sénégalais au format E.164 ou `null`) et `phoneStorageForms` (`+221…` et `221…`, les deux formes présentes en base). `team/invite` et `controller/setup` refusent un numéro non sénégalais (400 `INVALID_PHONE`) et cherchent par `.in('phone', …)`, égalité exacte ; plusieurs comptes → 409 `AMBIGUOUS_PHONE`. Le `phone.ilike.%<9 derniers chiffres>` et l'interpolation de `phone.trim()` disparaissent.
- Compte existant : aucune écriture sur `users` ni sur `auth.users` (nom, email, téléphone, mot de passe), aucun code OTP enregistré ; seul le rôle CONTROLEUR est ajouté, après confirmation. Le partenaire reçoit `{ requires_confirmation, code: 'EXISTING_ACCOUNT', existing_user: { display_name: 'Fa*** N***', phone } }` (`lib/security/mask.ts`). `resend` ne contourne plus la confirmation. Les pages `partner/team` et `partner/events/[id]/team` affichent le nom masqué.
- Nouveau compte : email de connexion synthétique ; le code d'activation part par SMS et n'est plus renvoyé dans la réponse.
- `team/assignments` : même réponse masquée.
- Filtres : `lib/security/postgrest-filter.ts` (`pgQuoted`, `pgEscapeLike`, `pgIlikeContains` : valeur entre guillemets PostgREST, jokers `%` `_` `*` neutralisés, caractères de contrôle retirés, 100 caractères au plus) pour la recherche admin et le slug des restaurants ; `pgEscapeLike` pour la recherche d'événements ; `.in()` pour la purge OTP de l'anonymisation.

**parcours/invitation-identite**

Run 22 (avant correctif) :

```text
    not ok 1 - invitation du numéro d’un client avec un autre email et un autre nom → nom masqué, confirmation, identité intacte
        → nom du titulaire révélé en clair : {"requires_confirmation":true,"existing_user":{"id":"a3c4fd61-9a67-4827-ae8f-0df70e08e452","first_name":"Mariétou","last_name":"Sarrdiop128701","phone":"+221772626092","role":"CLIENT"},"message":"Compte existant détecté — Mariétou Sarrdiop128701 (+221772626092) pos
    not ok 2 - après une invitation, la réinitialisation par téléphone reste liée à l’email du client
        → le lien de réinitialisation vise l’email du client
        → + 'parcours-pirate-reset-1bdf5066c0@test.eventvillage.local'
        → - 'parcours-reset-86858f67c1@test.eventvillage.local'
    not ok 3 - recherche par égalité exacte : un numéro étranger finissant par les 9 chiffres d’un client est refusé
        → numéro non sénégalais refusé : HTTP 200 {"requires_confirmation":true,"existing_user":{"id":"ccb4f4a3-cc95-47da-acff-1adddea7c4c6","first_name":"Mariétou","last_name":"Sarrdiop162963","phone":"+33774364645","role":"CLIENT"},"message":"Compte existant détecté — Mariétou Sarrdiop162963 (+33774364645) 
        → 200 !== 400
    not ok 4 - « resend » ne contourne plus la confirmation
        → confirmation exigée malgré resend : {"success":true,"assignments":[{"id":"1f2e2aa9-eb46-45fe-9e40-baf37bce76ae","event_id":"3e13162a-d079-4592-9245-6ba6e79a031a","user_id":"b93a4294-9272-4ab3-8922-ae7e21be19aa","can_accept_cash":false,"created_at":"2026-10-31T16:42:59.812264+00:00"}],"assignment":{"
        → + undefined
        → - true
    not ok 5 - nouveau compte invité : aucun code renvoyé au partenaire, email de connexion non choisi par le partenaire
        → le code d’activation ne doit pas être renvoyé au partenaire : {"success":true,"assignments":[{"id":"66649425-d24a-44da-88d3-010d1b6c43b9","event_id":"3e13162a-d079-4592-9245-6ba6e79a031a","user_id":"c39615a9-a8c7-4be1-afdc-3ba1febae58a","can_accept_cash":false,"created_at":"2026-10-31T16:43:00.01230
not ok 1 - Invitation : identité des comptes existants
# pass 0
# fail 5
```

Run 25 (après correctif) :

```text
    ok 1 - invitation du numéro d’un client avec un autre email et un autre nom → nom masqué, confirmation, identité intacte
    ok 2 - après une invitation, la réinitialisation par téléphone reste liée à l’email du client
    ok 3 - recherche par égalité exacte : un numéro étranger finissant par les 9 chiffres d’un client est refusé
    ok 4 - « resend » ne contourne plus la confirmation
    ok 5 - nouveau compte invité : aucun code renvoyé au partenaire, email de connexion non choisi par le partenaire
ok 1 - Invitation : identité des comptes existants
# pass 5
# fail 0
```

**parcours/filtres-postgrest**

Run 22 (avant correctif) :

```text
    not ok 1 - aucune interpolation brute dans un .or() / .filter() hors paiement (lot 2)
        → interpolations non assainies :
        → app/api/admin/users/route.ts:52 .or(… ${search} ${search} ${search} ${search} …)
        → app/api/controller/setup/route.ts:69 .or(… ${normalizedPhone} ${phone.trim()} ${suffix9} …)
        → app/api/partner/team/invite/route.ts:149 .or(… ${normalizedPhone} ${phone.trim()} ${suffix9} …)
    not ok 2 - recherche admin : une virgule dans « search » n’ajoute pas de condition au filtre
        → HTTP 500 {"error":"\"failed to parse logic tree ((first_name.ilike.%zzqxjv%,id.not.is.null%,last_name.ilike.%zzqxjv%,id.not.is.null%,email.ilike.%zzqxjv%,id.not.is.null%,phone.ilike.%zzqxjv%,id.not.is.null%))\" (line 1, column 44)"}
        → 500 !== 200
not ok 1 - Filtres PostgREST construits par interpolation
# pass 0
# fail 2
```

Run 25 (après correctif) :

```text
    ok 1 - aucune interpolation brute dans un .or() / .filter() hors paiement (lot 2)
    ok 2 - recherche admin : une virgule dans « search » n’ajoute pas de condition au filtre
ok 1 - Filtres PostgREST construits par interpolation
# pass 2
# fail 0
```

**parcours/statut-compte**

Run 22 (avant correctif) :

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

Run 25 (après correctif) :

```text
    ok 1 - invitation d’un compte SUSPENDU par le partenaire A → refus explicite, journalisé, statut inchangé
    ok 2 - invitation avec l’email d’un compte existant et un autre numéro → compte distinct, identifiants du titulaire intacts
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

### 1C.2 — Pièces d'inscription partenaire

**Grep de dépendance** (politiques Storage d'écriture supprimées : aucun accès Storage hors routes serveur service_role) :

```text
$ git grep -n -E 'storage\s*\.from\(|\.storage\b' 17ce0b2 -- app lib components hooks middleware.ts
17ce0b2:app/api/partner/documents/signed-url/route.ts:45:        const { data: signedData, error: signError } = await supabase.storage
17ce0b2:app/api/partner/documents/upload/route.ts:40:        const { data: buckets } = await supabase.storage.listBuckets();
17ce0b2:app/api/partner/documents/upload/route.ts:43:            await supabase.storage.createBucket('partner_documents', {
17ce0b2:app/api/partner/documents/upload/route.ts:59:        const { error: uploadError } = await supabase.storage
17ce0b2:app/api/partner/upload/route.ts:44:        const { data: buckets } = await supabase.storage.listBuckets();
17ce0b2:app/api/partner/upload/route.ts:47:            await supabase.storage.createBucket(BUCKET_NAME, {
17ce0b2:app/api/partner/upload/route.ts:62:        const { error: uploadError } = await supabase.storage
17ce0b2:app/api/partner/upload/route.ts:73:        const { data: urlData } = supabase.storage
(code de sortie 0)

$ git grep -n -E partner_documents 17ce0b2 -- app lib components hooks middleware.ts
17ce0b2:app/api/partner/documents/signed-url/route.ts:10: * Génère une URL signée temporaire pour consulter un document privé du bucket partner_documents
17ce0b2:app/api/partner/documents/signed-url/route.ts:46:            .from('partner_documents')
17ce0b2:app/api/partner/documents/upload/route.ts:39:        // Vérification de l'existence du bucket partner_documents (création si absent)
17ce0b2:app/api/partner/documents/upload/route.ts:41:        const bucketExists = buckets?.some(b => b.name === 'partner_documents');
17ce0b2:app/api/partner/documents/upload/route.ts:43:            await supabase.storage.createBucket('partner_documents', {
17ce0b2:app/api/partner/documents/upload/route.ts:60:            .from('partner_documents')
(code de sortie 0)

$ git grep -n -E 'signed-url|documents/upload' 17ce0b2 -- app lib components hooks middleware.ts
17ce0b2:app/admin/dashboard/page.tsx:134:      const res = await fetch(`/api/partner/documents/signed-url?path=${encodeURIComponent(filePath)}`);
17ce0b2:app/api/partner/documents/signed-url/route.ts:9: * GET /api/partner/documents/signed-url?path=...
17ce0b2:app/api/partner/documents/upload/route.ts:10: * POST /api/partner/documents/upload
17ce0b2:app/api/partner/documents/upload/route.ts:67:            console.error('[API /api/partner/documents/upload] Erreur upload:', uploadError);
17ce0b2:app/api/partner/documents/upload/route.ts:81:        console.error('[API /api/partner/documents/upload] Exception:', errorMsg);
17ce0b2:app/partner/register/page.tsx:109:            const idCardRes = await fetch('/api/partner/documents/upload', {
17ce0b2:app/partner/register/page.tsx:124:            const busRes = await fetch('/api/partner/documents/upload', {
17ce0b2:middleware.ts:9:    '/api/partner/documents/upload',
(code de sortie 0)
```

`app/api/partner/upload/route.ts` écrit dans le bucket `public-images`, pas dans `partner_documents`, et utilise lui aussi le service_role.

**Correctif.**
- Migration `20261031000007` : table `partner_document_uploads` (service_role uniquement) ; politiques `partner_documents_insert_own`, `…_update_own_or_admin`, `…_delete_own_or_admin` supprimées ; la lecture (`…_select_own_or_admin` : dossier `<uid>/` ou admin) est conservée et les dépôts sont sous `pending/<uuid>/`.
- Dépôt : type de pièce `id_card` ou `business_doc`, taille vérifiée, contenu identifié par sa signature (PDF, JPEG, PNG, WEBP), jamais par le type annoncé ; chemin `pending/<UUID v4>/<type>.<ext>` ; jeton de dépôt aléatoire (32 octets), seule son empreinte SHA-256 est stockée, valable 2 h ; quota par IP et par heure en base (`DOCUMENT_UPLOADS_PER_IP_HOUR`) ; le bucket n'est plus créé à la volée (migration `0005`).
- Inscription : pièces résolues par leurs jetons avant tout SMS (400 `INVALID_DOCUMENT_UPLOAD`), rattachées au dossier après sa création (usage unique, 409 si déjà utilisées).
- URL signée : propriétaire du dossier (`partners.user_id`, compte ACTIF ou EN_ATTENTE, c'est-à-dire dossier en cours de validation ; refusé s'il est suspendu ou supprimé ; option `allowStatuses` du helper commun `requireActiveSession`, dont le défaut reste ACTIF seul) ou admin (`partners.read`), sinon 403 ; par jeton tant que la pièce n'est pas rattachée (404, 403 après rattachement, 410 expiré) ; chemin toujours lu en base ; URL de 5 minutes, `Cache-Control: no-store`, consultation journalisée (`PARTNER_DOCUMENT_VIEWED`). Dossier antérieur au lot : chemin hérité servi à l'admin seulement (il avait été saisi par le client).

**parcours/documents-inscription**

Run 22 (avant correctif) :

```text
    not ok 1 - dépôt : chemin non devinable et jeton de dépôt
        → chemin aléatoire attendu : pending_registrations/id_card_1793464976226_c1r3tr.pdf
    not ok 2 - dépôt : type de pièce hors liste et contenu non conforme refusés
        → docType hors liste : HTTP 200
        → 200 !== 400
    not ok 3 - URL signée : propriétaire et admin oui, compte tiers 403
        → propriétaire : HTTP 400 {"error":"Chemin du fichier (path) requis."}
        → 400 !== 200
    not ok 4 - URL signée : un chemin fourni par le client n’est plus accepté
        → URL délivrée sur simple chemin : HTTP 200 {"success":true,"signedUrl":"http://127.0.0.1:54321/storage/v1/object/sign/partner_documents/pending_registrations/id_card_1793464976570_k5mjqd.pdf?token=eyJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJwYXJ0bmVyX2RvY3VtZW50cy9wZW5kaW5nX3JlZ2lzdHJhdGlvbnMvaWRfY2FyZF8xNzkzNDY
    not ok 5 - URL signée par jeton de dépôt : valable avant l’inscription, plus après
        → jeton non réclamé : HTTP 400 {"error":"Chemin du fichier (path) requis."}
        → 400 !== 200
not ok 1 - Documents d’inscription partenaire
# pass 0
# fail 5
```

Run 25 (après correctif) :

```text
    ok 1 - dépôt : chemin non devinable et jeton de dépôt
    ok 2 - dépôt : type de pièce hors liste et contenu non conforme refusés
    ok 3 - URL signée : propriétaire et admin oui, compte tiers 403
    ok 4 - URL signée : un chemin fourni par le client n’est plus accepté
    ok 5 - URL signée par jeton de dépôt : valable avant l’inscription, plus après
    ok 6 - dossier antérieur au lot 1C.2 : chemin hérité servi à l’admin seulement
ok 1 - Documents d’inscription partenaire
# pass 6
# fail 0
```

**security/r11-storage-documents**

Run 22 (avant correctif) :

```text
    ok 1 - anon : ni téléchargement ni liste
    ok 2 - compte tiers connecté : ni téléchargement ni liste
    not ok 3 - compte connecté : aucune écriture directe dans le bucket, même dans son propre dossier
        → écriture directe dans le bucket des pièces acceptée
not ok 1 - R11 — Storage des documents d’inscription
# pass 2
# fail 1
```

Run 25 (après correctif) :

```text
    ok 1 - anon : ni téléchargement ni liste
    ok 2 - compte tiers connecté : ni téléchargement ni liste
    ok 3 - compte connecté : aucune écriture directe dans le bucket, même dans son propre dossier
ok 1 - R11 — Storage des documents d’inscription
# pass 3
# fail 0
```

**partner-auth-complete**

Run 22 (avant correctif) :

```text
ok 1 - 1. Register Partenaire : Schéma strict avec documents obligatoires (Bucket Privé) et statut initial EN_ATTENTE
ok 2 - 2. OTP Validation : Code conforme et vérification
ok 3 - 3. OTP Invalide : Détection et rejet
ok 4 - 4. OTP Expiré : Rejet après dépassement de validité
ok 5 - 5. Login Valide : Rôle résolu côté serveur
ok 6 - 6. Login Mauvais Mot de Passe : Échec d'authentification
ok 7 - 7. Accès Partner Autorisé : Rôle PARTENAIRE -> /partner/*
ok 8 - 8. Accès Client → /partner Interdit
ok 9 - 9. Accès Partner → /admin Interdit
ok 10 - 10. Accès Admin → /admin Autorisé
ok 11 - 11. Accès Contrôleur → /partner/scan Autorisé
ok 12 - 12. Accès Client → /partner/scan Interdit
ok 13 - 13. Upload Document Autorisé : Dossier propriétaire auth.uid()
ok 14 - 14. Accès Document Autre Partenaire Interdit (Isolation Cross-Tenant)
ok 15 - 15. Validation Partenaire : Statut VALIDE et Notification
ok 16 - 16. Refus Partenaire : Statut REJETE avec motif conservé
ok 17 - 17. Suspension Partenaire : Statut SUSPENDU et blocage d'accès
ok 18 - 18. Réactivation Partenaire : Statut ACTIF restauré
ok 19 - 19. Reset Password : Token / OTP sécurisé
ok 20 - 20. Sensitive Action OTP : Protection des retraits
ok 21 - 21. Audit Log : Journalisation inaltérable des actions partenaires
ok 22 - 22. Anti-Brute-Force : RateLimiter bloque après 5 échecs consécutifs
ok 23 - 23. Première Activation : Durée 60 jours Standard vs 90 jours Founder
ok 24 - 24. Période d'Essai Idempotente : Non recalculée sur les connexions suivantes
# pass 24
# fail 0
```

Run 25 (après correctif) :

```text
ok 1 - 1. Register Partenaire : Schéma strict avec documents obligatoires (Bucket Privé) et statut initial EN_ATTENTE
ok 2 - 2. OTP Validation : Code conforme et vérification
ok 3 - 3. OTP Invalide : Détection et rejet
ok 4 - 4. OTP Expiré : Rejet après dépassement de validité
ok 5 - 5. Login Valide : Rôle résolu côté serveur
ok 6 - 6. Login Mauvais Mot de Passe : Échec d'authentification
ok 7 - 7. Accès Partner Autorisé : Rôle PARTENAIRE -> /partner/*
ok 8 - 8. Accès Client → /partner Interdit
ok 9 - 9. Accès Partner → /admin Interdit
ok 10 - 10. Accès Admin → /admin Autorisé
ok 11 - 11. Accès Contrôleur → /partner/scan Autorisé
ok 12 - 12. Accès Client → /partner/scan Interdit
ok 13 - 13. Upload Document Autorisé : Dossier propriétaire auth.uid()
ok 14 - 14. Accès Document Autre Partenaire Interdit (Isolation Cross-Tenant)
ok 15 - 15. Validation Partenaire : Statut VALIDE et Notification
ok 16 - 16. Refus Partenaire : Statut REJETE avec motif conservé
ok 17 - 17. Suspension Partenaire : Statut SUSPENDU et blocage d'accès
ok 18 - 18. Réactivation Partenaire : Statut ACTIF restauré
ok 19 - 19. Reset Password : Token / OTP sécurisé
ok 20 - 20. Sensitive Action OTP : Protection des retraits
ok 21 - 21. Audit Log : Journalisation inaltérable des actions partenaires
ok 22 - 22. Anti-Brute-Force : RateLimiter bloque après 5 échecs consécutifs
ok 23 - 23. Première Activation : Durée 60 jours Standard vs 90 jours Founder
ok 24 - 24. Période d'Essai Idempotente : Non recalculée sur les connexions suivantes
# pass 24
# fail 0
```

### 1C.3 — Déconnexion forcée

**Grep de dépendance** :

```text
$ git grep -n -E 'admin\.signOut|signOut\(' 17ce0b2 -- app lib components hooks middleware.ts
17ce0b2:app/api/auth/sign-out-global/route.ts:20:        await supabase.auth.admin.signOut(user.id, 'global');
17ce0b2:app/api/partner/team/assignments/route.ts:156:            const { error: signOutErr } = await supabase.auth.admin.signOut(controllerId, 'global');
17ce0b2:app/api/partner/team/controller/[controllerId]/route.ts:142:                await supabase.auth.admin.signOut(controllerId, 'global');
17ce0b2:app/api/partner/team/invite/route.ts:215:                    await supabase.auth.admin.signOut(existingProfile.id, 'global');
17ce0b2:app/controller/layout.tsx:22:        await supabase.auth.signOut({ scope: 'global' });
17ce0b2:app/controller/scanner/page.tsx:311:                        await supabase.auth.signOut({ scope: 'global' });
17ce0b2:app/controller/scanner/page.tsx:604:        await supabase.auth.signOut({ scope: 'global' });
17ce0b2:app/login/page.tsx:196:            await supabase.auth.signOut();
17ce0b2:app/profile/page.tsx:72:    await signOut();
17ce0b2:app/reset-password/page.tsx:240:            await supabase.auth.signOut();
17ce0b2:components/layout/AppLayout.tsx:480:                  onClick={() => signOut()}
17ce0b2:components/layout/AppLayout.tsx:597:                  onClick={() => { closeMobileMenu(); signOut(); }}
17ce0b2:components/layout/AppLayout.tsx:679:                  onClick={() => signOut()}
17ce0b2:components/layout/AppLayoutHeader.tsx:76:              onClick={() => signOut()}
17ce0b2:components/providers/AuthProvider.tsx:114:            await supabase.auth.signOut();
(code de sortie 0)
```

Quatre appels `auth.admin.signOut(<identifiant>)` côté serveur ; les `signOut()` côté navigateur utilisent le jeton de l'utilisateur et fonctionnent. L'appel de `team/invite` disparaît avec 1C.1 : le compte existant n'est plus modifié, il n'y a plus de session à couper.

**Choix : révocation réelle.** GoTrue n'a pas d'API d'administration qui révoque les sessions d'un compte par son identifiant ; `auth.admin.signOut` attend le JWT de l'utilisateur. La migration `20261031000008` ajoute `public.revoke_user_sessions(uuid)` (SECURITY DEFINER, `search_path` vide, service_role uniquement) : suppression de `auth.sessions`, révocation de `auth.refresh_tokens`. Elle dépend du schéma interne de GoTrue (v2.197.0 en CI) : le test de parcours le vérifie à chaque run.

**Correctif.** `lib/auth/sessions.ts` (`revokeUserSessions`, journal `USER_SESSIONS_REVOKED`, échec → `false`, jamais ignoré) appelé : retrait du dernier rôle CONTROLEUR par le partenaire (`team/controller/[id]`, `team/assignments`), `PATCH /api/admin/users` (rôle retiré ou statut autre qu'ACTIF), anonymisation (en plus du bannissement), suspension d'un partenaire, `/api/auth/sign-out-global`. Un échec de révocation renvoie 500. Le jeton d'accès déjà émis reste valable jusqu'à son expiration (1 h au plus) ; les droits sont relus en base à chaque requête (lot 1B).

**parcours/revocation-sessions**

Run 22 (avant correctif) :

```text
    ok 1 - témoin : sans action, le jeton de rafraîchissement donne une nouvelle session
    not ok 2 - retrait du dernier rôle CONTROLEUR par le partenaire → sessions révoquées
        → le jeton de rafraîchissement donne encore une session après le retrait du rôle
    not ok 3 - retrait de rôle par un admin → sessions révoquées
        → session encore rafraîchissable après retrait de rôle
    not ok 4 - suspension par un admin → sessions révoquées
        → session encore rafraîchissable après suspension
    ok 5 - anonymisation → sessions révoquées
    not ok 6 - déconnexion globale demandée par l’utilisateur → toutes ses sessions révoquées
        → session encore rafraîchissable après déconnexion globale
not ok 1 - Révocation des sessions
# pass 2
# fail 4
```

Run 25 (après correctif) :

```text
    ok 1 - témoin : sans action, le jeton de rafraîchissement donne une nouvelle session
    ok 2 - retrait du dernier rôle CONTROLEUR par le partenaire → sessions révoquées
    ok 3 - retrait de rôle par un admin → sessions révoquées
    ok 4 - suspension par un admin → sessions révoquées
    ok 5 - anonymisation → sessions révoquées
    ok 6 - déconnexion globale demandée par l’utilisateur → toutes ses sessions révoquées
ok 1 - Révocation des sessions
# pass 6
# fail 0
```

### 1C.4 — Codes OTP hachés

**Grep de dépendance** (colonne `code` supprimée) :

```text
$ git grep -n -E otp_codes 17ce0b2 -- app lib components hooks middleware.ts scripts
17ce0b2:app/api/auth/verify-otp/route.ts:47:        // 1-2. Lot 1B.7 : vérification en base uniquement (otp_codes), indépendante de l'instance
17ce0b2:app/api/partner/team/controller/[controllerId]/route.ts:150:                    await supabase.from('otp_codes').delete().eq('phone', ctrlProfile.phone);
17ce0b2:app/api/partner/team/controller/[controllerId]/route.ts:152:                    console.warn('[DELETE team/controller] otp_codes delete non-bloquant:', otpErr);
17ce0b2:lib/admin/admin.service.ts:364:                ? (supabase.from('otp_codes') as any)
17ce0b2:lib/admin/admin.service.ts:369:        const cleanupLabels = ['event_controllers', 'user_roles CONTROLEUR', 'admin_permissions', 'otp_codes'];
17ce0b2:lib/auth/otp-store.ts:2: * Lot 1B.7 — codes OTP en base (public.otp_codes, service_role uniquement).
17ce0b2:lib/auth/otp-store.ts:19:        .from('otp_codes')
17ce0b2:lib/auth/otp-store.ts:33:        .from('otp_codes')
17ce0b2:lib/auth/otp-store.ts:46:        const { error: incErr } = await supabase.from('otp_codes').update({ attempts: attempts + 1 }).eq('id', record.id);
17ce0b2:lib/auth/otp-store.ts:56:        .from('otp_codes')
17ce0b2:lib/security/sensitive-action.service.ts:21:        // Insertion dans la table public.otp_codes
17ce0b2:lib/security/sensitive-action.service.ts:22:        await supabase.from('otp_codes').insert({
17ce0b2:lib/security/sensitive-action.service.ts:56:            .from('otp_codes')
17ce0b2:lib/security/sensitive-action.service.ts:76:                .from('otp_codes')
17ce0b2:lib/security/sensitive-action.service.ts:85:            .from('otp_codes')
(code de sortie 0)

$ git grep -n -E 'SensitiveActionService|sensitive-action' 17ce0b2 -- . ':!docs'
17ce0b2:lib/security/sensitive-action.service.ts:5:export class SensitiveActionService {
17ce0b2:supabase/hotfix/2026-10-31-lot1a/02-hotfix.sql:70:-- /api/auth/*, /api/controller/setup, /api/partner/*, lib/security/sensitive-action.service.ts).
17ce0b2:supabase/migrations/20261031000002_lot1a_failles_sans_privilege.sql:59:-- /api/auth/*, /api/controller/setup, /api/partner/*, lib/security/sensitive-action.service.ts).
17ce0b2:tests/partner-auth-complete.test.ts:7:import { SensitiveActionService } from '../lib/security/sensitive-action.service';
(code de sortie 0)
```

`lib/security/sensitive-action.service.ts` est le seul autre lecteur de `otp_codes.code` ; il n'est importé que par un test, qui ne l'utilisait pas : supprimé.

**Correctif.** Migration `20261031000009` : codes existants supprimés (invalidés), colonne `code` supprimée, `code_hash` obligatoire (64 caractères hexadécimaux), index `(phone, created_at DESC)`. `lib/auth/otp-store.ts` : HMAC-SHA256 avec `OTP_HASH_SECRET`, message `event-village:otp:v1 \0 numéro \0 code`, comparaison `timingSafeEqual`. `lib/env.ts` : `OTP_HASH_SECRET` obligatoire (32 caractères au moins), sans repli, différent de `SUPABASE_SERVICE_ROLE_KEY` et de `SUPABASE_AUTH_HOOK_SECRET`. La vérification reste en base, donc indépendante de l'instance (test « depuis une autre instance »).

**parcours/otp-hachage**

Run 22 (avant correctif) :

```text
    not ok 1 - après émission, aucune colonne ne contient le code en clair ; la vérification fonctionne depuis une autre instance
        → colonnes contenant le code en clair : code
        → +   'code'
        → - []
    not ok 2 - OTP_HASH_SECRET est obligatoire, sans valeur de repli
        → Missing expected exception: getServerEnv doit refuser un environnement sans OTP_HASH_SECRET
not ok 1 - Codes OTP hachés
# pass 0
# fail 2
```

Run 25 (après correctif) :

```text
    ok 1 - après émission, aucune colonne ne contient le code en clair ; la vérification fonctionne depuis une autre instance
    ok 2 - OTP_HASH_SECRET est obligatoire, sans valeur de repli
ok 1 - Codes OTP hachés
# pass 2
# fail 0
```

**security/r2-otp-codes**

Run 22 (avant correctif) :

```text
    ok 1 - anon : lecture refusée
    ok 2 - anon : insertion refusée
    ok 3 - authenticated (compte CLIENT gratuit) : lecture, insertion, modification et suppression refusées
ok 1 - R2 — otp_codes inaccessible par anon et authenticated
# pass 3
# fail 0
```

Run 25 (après correctif) :

```text
    ok 1 - anon : lecture refusée
    ok 2 - anon : insertion refusée
    ok 3 - authenticated (compte CLIENT gratuit) : lecture, insertion, modification et suppression refusées
ok 1 - R2 — otp_codes inaccessible par anon et authenticated
# pass 3
# fail 0
```

**parcours/otp-serveur**

Run 22 (avant correctif) :

```text
    ok 1 - send-otp → otp_codes → verify-otp depuis une autre instance
    ok 2 - inscription client → otp_codes → verify-otp depuis une autre instance
    ok 3 - inscription partenaire → otp_codes → verify-otp depuis une autre instance
ok 1 - Parcours OTP serveur
# pass 3
# fail 0
```

Run 25 (après correctif) :

```text
    ok 1 - send-otp → otp_codes → verify-otp depuis une autre instance
    ok 2 - inscription client → otp_codes → verify-otp depuis une autre instance
    ok 3 - inscription partenaire → otp_codes → verify-otp depuis une autre instance
ok 1 - Parcours OTP serveur
# pass 3
# fail 0
```

### 1C.5 — Rôles hors des métadonnées

**Grep de dépendance** :

```text
$ git grep -n -E 'user_metadata\??\.roles?\b|raw_user_meta_data' 17ce0b2 -- app lib components hooks middleware.ts
(code de sortie 1)

$ git grep -n -E 'sync_user_roles_to_jwt|trg_sync_roles_to_jwt' 17ce0b2 -- supabase/migrations
17ce0b2:supabase/migrations/20260906000004_user_roles_multi_role.sql:91:CREATE OR REPLACE FUNCTION sync_user_roles_to_jwt()
17ce0b2:supabase/migrations/20260906000004_user_roles_multi_role.sql:148:CREATE TRIGGER trg_sync_roles_to_jwt
17ce0b2:supabase/migrations/20260906000004_user_roles_multi_role.sql:150:    FOR EACH ROW EXECUTE FUNCTION sync_user_roles_to_jwt();
17ce0b2:supabase/migrations/20261031000001_functions_search_path.sql:9:-- INSERT user_roles → sync_user_roles_to_jwt, audit_log_changes) utilisent des
17ce0b2:supabase/migrations/20261031000001_functions_search_path.sql:22:ALTER FUNCTION public.sync_user_roles_to_jwt() SET search_path = public, auth, extensions;
(code de sortie 0)
```

Plus aucun code applicatif ne lit les rôles dans les métadonnées depuis le lot 1B.1 (contrôle statique de R6, vert). Les définitions de `handle_new_user` des migrations `0005` et `0006` sont remplacées depuis le lot 1A.

**Correctif.** Migration `20261031000010` : `sync_user_roles_to_jwt` (nom conservé, référencé par le trigger et les inventaires) ne met plus à jour que `public.users.role`, avec la même priorité (SUPERADMIN > ADMIN > PARTENAIRE > CONTROLEUR > CLIENT) ; les clés `role` et `roles` de `raw_user_meta_data` existantes sont retirées. Le seed des fixtures n'en écrit plus.

**parcours/roles-metadonnees**

Run 22 (avant correctif) :

```text
    not ok 1 - trigger : attribution et retrait de rôles sans écriture dans raw_user_meta_data ; users.role suit la priorité
        → Expected values to be strictly deep-equal:
        → +     keys: [
        → +       'role',
        → +       'roles'
    not ok 2 - fixtures du seed : aucune clé role / roles dans les métadonnées
        → métadonnées porteuses de rôles :
        → PARTNER_A : role, roles
        → CONTROLLER_A : role, roles
        → ADMIN : role, roles
    not ok 3 - attribution par le serveur : métadonnées sans rôle, accès /partner ouvert par le middleware
        → rôles recopiés dans les métadonnées : {"email_verified":true,"role":"CLIENT","roles":["CLIENT","PARTENAIRE"]}
        → +   'role',
        → +   'roles'
        → - []
not ok 1 - Rôles hors des métadonnées utilisateur
# pass 0
# fail 3
```

Run 25 (après correctif) :

```text
    ok 1 - trigger : attribution et retrait de rôles sans écriture dans raw_user_meta_data ; users.role suit la priorité
    ok 2 - fixtures du seed : aucune clé role / roles dans les métadonnées
    ok 3 - attribution par le serveur : métadonnées sans rôle, accès /partner ouvert par le middleware
ok 1 - Rôles hors des métadonnées utilisateur
# pass 3
# fail 0
```

**parcours/attribution-roles**

Run 22 (avant correctif) :

```text
    not ok 1 - inscription partenaire → PARTENAIRE dans user_roles et pour la session
        → aucun rôle dans user_metadata (lot 1C.5) : {"company_name":"Parcours Test SARL","email_verified":true,"first_name":"Fatou","last_name":"Parcours","role":"CLIENT","roles":["CLIENT","PARTENAIRE"]}
    not ok 2 - création d'un compte CONTROLEUR par un SUPERADMIN → CONTROLEUR dans user_roles et pour la session
        → aucun rôle dans user_metadata (lot 1C.5) : {"email_verified":true,"first_name":"Ibrahima","last_name":"CreeParAdmin","role":"CLIENT","roles":["CLIENT","CONTROLEUR"]}
    ok 3 - invitation d'un contrôleur par le partenaire A → CONTROLEUR dans user_roles + affectation
not ok 1 - Attribution des rôles par les routes serveur
# pass 1
# fail 2
```

Run 25 (après correctif) :

```text
    ok 1 - inscription partenaire → PARTENAIRE dans user_roles et pour la session
    ok 2 - création d'un compte CONTROLEUR par un SUPERADMIN → CONTROLEUR dans user_roles et pour la session
    ok 3 - invitation d'un contrôleur par le partenaire A → CONTROLEUR dans user_roles + affectation
ok 1 - Attribution des rôles par les routes serveur
# pass 3
# fail 0
```

**schema/hotfix-scripts**

Run 22 (avant correctif) :

```text
    ok 1 - 01-detection.sql : exécution en lecture seule
    ok 2 - 02-hotfix.sql : appliqué deux fois sans erreur (idempotent)
    ok 3 - 01-detection.sql section A : gravité par rôle réclamé, selon user_roles et la trace serveur
    ok 4 - 03-verification.sql : tous les points OK
ok 1 - Scripts de hotfix du lot 1A
# pass 4
# fail 0
```

Run 25 (après correctif) :

```text
    ok 1 - 01-detection.sql : exécution en lecture seule
    ok 2 - 02-hotfix.sql : appliqué deux fois sans erreur (idempotent)
    ok 3 - 01-detection.sql section A : gravité par rôle réclamé, selon user_roles et la trace serveur
    ok 4 - 03-verification.sql : tous les points OK
ok 1 - Scripts de hotfix du lot 1A
# pass 4
# fail 0
```

### 1C.6 — Secrets codés en dur

**Grep de dépendance** (`scratch/` et `tests/exploit-before.ts`) :

```text
$ git grep -n -E 'scratch/|scratch'"'"'|exploit-before' 17ce0b2 -- . ':!scratch' ':!docs'
17ce0b2:.gitignore:45:scratch/
17ce0b2:tests/schema/secrets-codes-en-dur.test.ts:3: *  - scratch/ (scripts ad hoc visant le projet distant) et tests/exploit-before.ts sont supprimés ;
17ce0b2:tests/schema/secrets-codes-en-dur.test.ts:24:    test('scratch/ et tests/exploit-before.ts ne sont plus suivis', () => {
17ce0b2:tests/schema/secrets-codes-en-dur.test.ts:25:        assert.deepEqual(tracked('scratch'), [], 'fichiers scratch/ encore suivis par git');
17ce0b2:tests/schema/secrets-codes-en-dur.test.ts:26:        assert.deepEqual(tracked('tests/exploit-before.ts'), [], 'tests/exploit-before.ts encore suivi par git');
(code de sortie 0)

$ git grep -n -E 'process\.env\.\w*(SECRET|KEY|SALT|PASSWORD|TOKEN)\w*[^;]*(\|\||\?\?)\s*['"'"'"`][^'"'"'"`]{6,}' 17ce0b2 -- app lib middleware.ts
17ce0b2:lib/security/totp.ts:18:    const masterKey = process.env.SUPABASE_AUTH_HOOK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'even***(35)';
17ce0b2:lib/shifts/shift.service.ts:51:    return process.env.SUPABASE_AUTH_HOOK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'even***(37)';
(code de sortie 0)
```

Seul `.gitignore` mentionne `scratch/`. Aucun script npm, fichier de configuration, import ni workflow ne référence ces fichiers. Trois fichiers locaux de `scratch/`, non suivis et ignorés, restent sur le poste ; ils ne sont pas distribués.

**Correctif.** `scratch/` (17 fichiers suivis) et `tests/exploit-before.ts` supprimés. Valeurs de repli littérales retirées de `lib/security/totp.ts` et `lib/shifts/shift.service.ts` : la clé reste `SUPABASE_AUTH_HOOK_SECRET || SUPABASE_SERVICE_ROLE_KEY`, la valeur dérivée est donc inchangée dès que l'une des deux est définie, et l'absence des deux lève une erreur. Tests actifs : `TEST_PASSWORD` des fixtures locales. Suites legacy : `process.env.LEGACY_TEST_PASSWORD` (section 5). Valeurs masquées dans `docs/` (audit, annexe, lot 0). Inventaire en section 4.

**schema/secrets-codes-en-dur**

Run 22 (avant correctif) :

```text
    not ok 1 - scratch/ et tests/exploit-before.ts ne sont plus suivis
        → fichiers scratch/ encore suivis par git
        → +   'scratch/check-last-otp.ts',
        → +   'scratch/create-superadmin.ts',
        → +   'scratch/delete-user.ts',
    not ok 2 - aucun mot de passe littéral dans tests/ et scripts/
        → mots de passe littéraux (valeurs non affichées) :
        → tests/exploit-before.ts:33
        → tests/exploit-before.ts:36
        → tests/exploit-before.ts:55
    not ok 3 - aucun secret de repli littéral dans le code serveur
        → secrets de repli littéraux (valeurs non affichées) :
        → lib/security/totp.ts:18
        → lib/shifts/shift.service.ts:51
        → +   'lib/security/totp.ts:18',
not ok 1 - Secrets codés en dur
# pass 0
# fail 3
```

Run 25 (après correctif) :

```text
    ok 1 - scratch/ et tests/exploit-before.ts ne sont plus suivis
    ok 2 - aucun mot de passe littéral dans tests/ et scripts/
    ok 3 - aucun secret de repli littéral dans le code serveur
ok 1 - Secrets codés en dur
# pass 3
# fail 0
```

### 1C.7 — Interblocage de `partner-halls-m7` (constat, aucun code modifié)

**Grep** :

```text
$ git grep -n -E '40P01|40001|deadlock|serialization_failure' 17ce0b2 -- app lib supabase/migrations
(code de sortie 1)

$ git grep -n -E 'HallService\.createReservation|create_hall_reservation_atomic' 17ce0b2 -- app lib tests
17ce0b2:tests/partner-halls-m7.test.ts:130:            HallService.createReservation({
17ce0b2:tests/partner-halls-m7.test.ts:137:            HallService.createReservation({
17ce0b2:tests/partner-halls-m7.test.ts:230:        const reservation = await HallService.createReservation({
17ce0b2:tests/partner-halls-m7.test.ts:311:        const reservation = await HallService.createReservation({
17ce0b2:tests/security/r3-fonctions-rpc.test.ts:16:    ['create_hall_reservation_atomic', { p_hall_id: ZERO_UUID, p_client_id: ZERO_UUID, p_start_date: '2030-01-01', p_end_date: '2030-01-02' }],
17ce0b2:tests/ux-performance-and-double-click.test.ts:101:            HallService.createReservation({
17ce0b2:tests/ux-performance-and-double-click.test.ts:107:            HallService.createReservation({
(code de sortie 0)

$ git grep -n -E 'from\('"'"'hall_reservations'"'"'\)' 17ce0b2 -- app lib
17ce0b2:app/api/halls/reserve/route.ts:74:            .from('hall_reservations')
17ce0b2:app/api/halls/reserve/route.ts:90:            .from('hall_reservations')
17ce0b2:app/api/orders/route.ts:52:            .from('hall_reservations')
17ce0b2:app/api/partner/finance/route.ts:41:            supabase.from('hall_reservations')
17ce0b2:lib/halls/hall.service.ts:186:            .from('hall_reservations')
17ce0b2:lib/halls/hall.service.ts:233:            .from('hall_reservations')
17ce0b2:lib/halls/hall.service.ts:276:            .from('hall_reservations')
17ce0b2:lib/halls/hall.service.ts:343:            .from('hall_reservations')
17ce0b2:lib/halls/hall.service.ts:376:            .from('hall_reservations')
17ce0b2:lib/halls/hall.service.ts:393:            .from('hall_reservations')
17ce0b2:lib/payments/payment.service.ts:90:                    .from('hall_reservations')
17ce0b2:lib/payments/payment.service.ts:852:                    .from('hall_reservations')
17ce0b2:lib/payments/payment.service.ts:916:                    .from('hall_reservations')
17ce0b2:lib/payments/payment.service.ts:1045:            .from('hall_reservations')
17ce0b2:lib/payments/payment.service.ts:1058:            .from('hall_reservations')
(code de sortie 0)
```

**Traitement actuel de 40P01 : aucun.** Aucun code de l'application ne détecte 40P01 ni 40001, ne le convertit en conflit ni ne relance.
- **Chemin du test** (`tests/partner-halls-m7.test.ts`, cas 2) : deux `HallService.createReservation` simultanés. Ce service n'est appelé que par des tests ; la fonction SQL `create_hall_reservation_atomic` (qui verrouille la salle `FOR UPDATE`) n'est appelée nulle part. Le service fait un pré-contrôle sans verrou puis un `insert` PostgREST. En cas de 40P01, il lève `Échec création réservation: deadlock detected` : seuls le code 23P01 et des mots du message de conflit sont reconnus (`lib/halls/hall.service.ts`). C'est l'échec observé au run 15 (assertion sur le message « déjà réservée »).
- **Route de production** (`app/api/halls/reserve/route.ts`, appelée par `app/halls/[id]/page.tsx`) : sa propre logique, même pré-contrôle sans verrou (409) puis `insert` direct. Tout échec d'insertion, 40P01 compris, mais aussi 23P01 (contrainte d'exclusion) et P0001 (trigger), donne un 500 « Impossible d'enregistrer la réservation. » au lieu d'un 409.
- **Mécanisme probable** : deux insertions concurrentes dans l'index GiST de la contrainte d'exclusion `no_overlapping_hall_reservations` ; chacune voit la ligne non validée de l'autre et l'attend ; le détecteur annule l'une (après `deadlock_timeout`, 1 s par défaut). Le trigger `check_hall_availability` est un simple SELECT, sans verrou. Hypothèse argumentée à partir du SQL, non reproduite.
- **Ailleurs** : les boucles de réservation de stock de la billetterie relancent sur toute erreur sans lire le code ; les retraits et le compostage utilisent `pg_advisory_xact_lock` ; seuls `23505` et `22P02` sont traités explicitement.
- **À traiter dans le lot des salles** : passer la route par `create_hall_reservation_atomic` (ou un verrou sur la salle), traduire 23P01/P0001 en 409 et 40P01 en nouvelle tentative bornée, puis aligner le test sur la route réelle.

### 1C.8 — Email optionnel, SMS obligatoire

**Grep de dépendance** :

```text
$ git grep -n -E 'getEmailAdapter|ResendHttpAdapter' 17ce0b2 -- app lib components hooks middleware.ts
17ce0b2:lib/email/email.service.ts:10:import { getEmailAdapter } from '@/lib/integrations/registry';
17ce0b2:lib/email/email.service.ts:660:        return getEmailAdapter().send(payload);
17ce0b2:lib/email/resend-http.adapter.ts:8:export class ResendHttpAdapter implements EmailAdapter {
17ce0b2:lib/email/resend-http.adapter.ts:20:            console.warn('[ResendHttpAdapter] RESEND_API_KEY manquant — email non expédié :', payload.subject);
17ce0b2:lib/email/resend-http.adapter.ts:25:            const res = await fetch(ResendHttpAdapter.RESEND_API, {
17ce0b2:lib/email/resend-http.adapter.ts:32:                    from: payload.from ?? ResendHttpAdapter.fromAddress(),
17ce0b2:lib/email/resend-http.adapter.ts:43:                console.warn('[ResendHttpAdapter] Resend API error:', msg, '— sujet:', payload.subject);
17ce0b2:lib/email/resend-http.adapter.ts:51:            console.warn('[ResendHttpAdapter] Exception envoi:', msg, '— sujet:', payload.subject);
17ce0b2:lib/integrations/registry.ts:10:import { ResendHttpAdapter } from '@/lib/email/resend-http.adapter';
17ce0b2:lib/integrations/registry.ts:52:export function getEmailAdapter(): EmailAdapter {
17ce0b2:lib/integrations/registry.ts:55:    if (!realCache.email) realCache.email = new ResendHttpAdapter();
(code de sortie 0)

$ git grep -n -c -E 'EmailService\.(send|sendToMany)\(' 17ce0b2 -- app lib components hooks middleware.ts
17ce0b2:lib/email/email.service.ts:1
17ce0b2:lib/events/event-cancellation.service.ts:1
17ce0b2:lib/events/event.service.ts:4
17ce0b2:lib/notifications/notification.service.ts:12
17ce0b2:lib/tickets/ticket-transfer.service.ts:1
(code de sortie 0)
```

Tous les emails passent par `EmailService.send` / `sendToMany`, seul appelant de l'adaptateur Resend.

**Correctif.** `lib/env.ts` : `MTARGET_USERNAME` / `MTARGET_PASSWORD` obligatoires, Resend optionnel. `lib/notifications/channels.ts` : canal email actif seulement avec `RESEND_API_KEY` (relue à chaque appel), avertissement unique par processus. `EmailService.send` / `sendToMany` ne tentent rien sans clé ; l'avis email aux superadmins est sauté ; SMS et notifications in-app inchangés ; aucune route en erreur. `instrumentation.ts` (`experimental.instrumentationHook`) émet l'avertissement au démarrage du serveur. `.env.example` et `docs/deploiement-projet-neuf.md` mis à jour.

**parcours/email-optionnel**

Run 22 (avant correctif) :

```text
    not ok 1 - inscriptions et achat sans RESEND_API_KEY : SMS envoyés, aucun email tenté, un seul avertissement
        → emails tentés sans RESEND_API_KEY : parcours-partenaire-sans-email-55ad3c0cbf@test.eventvillage.local, admin@test.eventvillage.local, superadmin@test.eventvillage.local, parcours-bootstrap-ok-4e02f4e3f0@test.eventvillage.local, client@test.eventvillage.local, partner-a@test.eventvillage.local
        → 6 !== 0
    not ok 2 - sans identifiants MTarget, la configuration serveur est refusée
        → Missing expected exception: MTARGET_USERNAME doit être obligatoire
not ok 1 - Email optionnel, SMS obligatoire
# pass 0
# fail 2
```

Run 25 (après correctif) :

```text
    ok 1 - inscriptions et achat sans RESEND_API_KEY : SMS envoyés, aucun email tenté, un seul avertissement
    ok 2 - sans identifiants MTarget, la configuration serveur est refusée
ok 1 - Email optionnel, SMS obligatoire
# pass 2
# fail 0
```

### 1C.9 — Anti-abus SMS

**Grep de dépendance** (déclencheurs et limiteurs) :

```text
$ git grep -n -E 'mTargetService\.(send\w*)\(' 17ce0b2 -- app lib components hooks middleware.ts
17ce0b2:app/api/admin/communications/route.ts:123:                    const res = await mTargetService.sendSms(phone, formattedMsg);
17ce0b2:app/api/auth/register/route.ts:49:            await mTargetService.sendOtp(normalizedPhone, otpCode);
17ce0b2:app/api/auth/send-otp/route.ts:103:            const sendResult = await mTargetService.sendOtp(normalizedPhone, otpCode);
17ce0b2:app/api/auth/sms-hook/route.ts:104:        const sendResult = await mTargetService.sendOtp(phone, otpCode.toString());
17ce0b2:app/api/controller/setup/route.ts:156:            await mTargetService.sendControllerActivationConfirmation(normalizedPhone);
17ce0b2:app/api/partner/register/route.ts:61:            await mTargetService.sendOtp(normalizedPhone, otpCode);
17ce0b2:app/api/partner/team/[eventId]/route.ts:142:                await mTargetService.sendControllerRevocationNotice(ctrlUser.phone, eventTitle);
17ce0b2:app/api/partner/team/all/route.ts:246:                await mTargetService.sendControllerAllEventsRevokedNotice(ctrlUser.phone);
17ce0b2:app/api/partner/team/assignments/route.ts:243:                await mTargetService.sendControllerAssignmentsUpdatedNotice(ctrlUser.phone, requestedEventIds.length);
17ce0b2:app/api/partner/team/controller/[controllerId]/route.ts:160:                await mTargetService.sendControllerAccountDeletedNotice(ctrlProfile.phone);
17ce0b2:app/api/partner/team/invite/route.ts:379:                const smsRes = await mTargetService.sendControllerInvite(
17ce0b2:app/api/partner/team/invite/route.ts:397:                const smsRes = await mTargetService.sendNotification(normalizedPhone, smsMsg);
17ce0b2:lib/events/event-cancellation.service.ts:923:                await mTargetService.sendSms(params.buyerPhone, smsText);
17ce0b2:lib/events/event.service.ts:416:                                mTargetService.sendSms(
17ce0b2:lib/events/event.service.ts:839:                    mTargetService.sendSms(
17ce0b2:lib/events/event.service.ts:860:                    mTargetService.sendSms(
17ce0b2:lib/events/event.service.ts:881:                    mTargetService.sendSms(
17ce0b2:lib/notifications/notification.service.ts:64:                const res = await mTargetService.sendSms(params.phone, smsToPartner);
17ce0b2:lib/notifications/notification.service.ts:184:                            const res = await mTargetService.sendSms(phone, params.smsMessage!);
17ce0b2:lib/notifications/notification.service.ts:233:            const res = await mTargetService.sendSms(params.phone, msg);
17ce0b2:lib/notifications/notification.service.ts:265:                const res = await mTargetService.sendSms(params.phone, smsMessage);
17ce0b2:lib/notifications/notification.service.ts:345:                const res = await mTargetService.sendSms(params.phone, smsMessage);
17ce0b2:lib/notifications/notification.service.ts:387:                const res = await mTargetService.sendSms(params.phone, smsMessage);
17ce0b2:lib/notifications/notification.service.ts:410:            const res = await mTargetService.sendSms(params.phone, msg);
17ce0b2:lib/notifications/notification.service.ts:438:                const res = await mTargetService.sendSms(params.phone, smsMessage);
17ce0b2:lib/notifications/notification.service.ts:501:                const res = await mTargetService.sendSms(params.phone, smsMessage);
17ce0b2:lib/notifications/notification.service.ts:622:                const res = await mTargetService.sendSms(partnerPhone, smsMessage);
17ce0b2:lib/notifications/notification.service.ts:732:                    const smsRes = await mTargetService.sendSms(clientPhone, clientSms);
17ce0b2:lib/notifications/notification.service.ts:786:                    const orgSmsRes = await mTargetService.sendSms(partnerPhone, partnerSms);
17ce0b2:lib/notifications/notification.service.ts:917:                    const smsRes = await mTargetService.sendSms(partnerPhone, orgSms);
17ce0b2:lib/notifications/notification.service.ts:1028:                    const smsRes = await mTargetService.sendSms(partnerPhone, orgSms);
17ce0b2:lib/notifications/notification.service.ts:1169:                    const smsRes = await mTargetService.sendSms(buyerPhone, clientSms);
17ce0b2:lib/notifications/notification.service.ts:1240:                    await mTargetService.sendSms(senderUser.phone, `Event Village : ${senderMsg}`);
17ce0b2:lib/notifications/notification.service.ts:1270:                    await mTargetService.sendSms(recipientUser.phone, `Event Village : ${recipientMsg} Rendez-vous dans votre espace pour le consulter.`);
17ce0b2:lib/notifications/notification.service.ts:1304:                    await mTargetService.sendSms(params.recipientPhoneOrEmail, msg);
17ce0b2:lib/notifications/notification.service.ts:1336:                    await mTargetService.sendSms(params.recipientPhoneOrEmail, msg);
17ce0b2:lib/payments/payment.service.ts:716:                            await mTargetService.sendSms(cleanPhone, smsText);
17ce0b2:lib/tickets/ticket-transfer.service.ts:328:                const smsRes = await mTargetService.sendSms(recipient, smsText);
(code de sortie 0)

$ git grep -n -E 'getSmsAdapter|MTargetHttpAdapter|new MTargetService' 17ce0b2 -- app lib components hooks middleware.ts tests ':!tests/legacy'
17ce0b2:lib/integrations/registry.ts:12:import { MTargetHttpAdapter } from '@/lib/sms/mtarget-http.adapter';
17ce0b2:lib/integrations/registry.ts:45:export function getSmsAdapter(): SmsAdapter {
17ce0b2:lib/integrations/registry.ts:48:    if (!realCache.sms) realCache.sms = new MTargetHttpAdapter();
17ce0b2:lib/sms/mtarget-http.adapter.ts:47:export class MTargetHttpAdapter implements SmsAdapter {
17ce0b2:lib/sms/mtarget-http.adapter.ts:58:            console.error(`[MTargetHttpAdapter] Numéro de destinataire invalide : ${to}`);
17ce0b2:lib/sms/mtarget-http.adapter.ts:73:            console.warn('[MTargetHttpAdapter] Identifiants MTARGET_USERNAME / MTARGET_PASSWORD manquants dans l\'environnement.');
17ce0b2:lib/sms/mtarget-http.adapter.ts:113:                console.error(`[MTargetHttpAdapter] Erreur HTTP ${response.status}:`, textResponse);
17ce0b2:lib/sms/mtarget-http.adapter.ts:123:            console.log(`[MTargetHttpAdapter] SMS envoyé au ${formattedRecipient} (Ticket: ${ticketId})`);
17ce0b2:lib/sms/mtarget-http.adapter.ts:133:            console.error('[MTargetHttpAdapter] Erreur lors de l\'envoi du SMS:', errorMsg);
17ce0b2:lib/sms/mtarget.service.ts:7:import { getSmsAdapter, integrationsMode } from '@/lib/integrations/registry';
17ce0b2:lib/sms/mtarget.service.ts:9:import { MTargetHttpAdapter, type MTargetConfig } from './mtarget-http.adapter';
17ce0b2:lib/sms/mtarget.service.ts:26:        this.dedicatedAdapter = config && integrationsMode() === 'real' ? new MTargetHttpAdapter(config) : null;
17ce0b2:lib/sms/mtarget.service.ts:30:        return this.dedicatedAdapter ?? getSmsAdapter();
17ce0b2:lib/sms/mtarget.service.ts:88:export const mTargetService = new MTargetService();
17ce0b2:tests/parcours/sms-anti-abus.test.ts:163:                    if (/getSmsAdapter|MTargetHttpAdapter|mtarget\.fr/.test(src)) offenders.push(rel);
(code de sortie 0)

$ git grep -n -E 'RateLimiter|rate_limits' 17ce0b2 -- app lib components hooks middleware.ts
17ce0b2:app/api/auth/resolve-phone/route.ts:28:        const { RateLimiter } = await import('@/lib/security/rate-limiter');
17ce0b2:app/api/auth/resolve-phone/route.ts:29:        const limitCheck = await RateLimiter.isRateLimited(normalizedPhone);
17ce0b2:app/api/auth/resolve-phone/route.ts:54:            await RateLimiter.recordFailedAttempt(normalizedPhone);
17ce0b2:app/api/auth/resolve-phone/route.ts:61:        await RateLimiter.resetAttempts(normalizedPhone);
17ce0b2:app/api/auth/send-otp/route.ts:44:        const { RateLimiter } = await import('@/lib/security/rate-limiter');
17ce0b2:app/api/auth/send-otp/route.ts:45:        const limitCheck = await RateLimiter.isRateLimited(`otp_send_${normalizedPhone}`);
17ce0b2:app/api/auth/send-otp/route.ts:119:        await RateLimiter.recordFailedAttempt(`otp_send_${normalizedPhone}`);
17ce0b2:app/api/auth/verify-otp/route.ts:35:        const { RateLimiter } = await import('@/lib/security/rate-limiter');
17ce0b2:app/api/auth/verify-otp/route.ts:36:        const limitCheck = await RateLimiter.isRateLimited(`otp_verify_${normalizedPhone}`);
17ce0b2:app/api/auth/verify-otp/route.ts:51:            await RateLimiter.recordFailedAttempt(`otp_verify_${normalizedPhone}`);
17ce0b2:app/api/auth/verify-otp/route.ts:56:        await RateLimiter.resetAttempts(`otp_verify_${normalizedPhone}`);
17ce0b2:app/api/controller/scan/route.ts:9:import { RateLimiter } from '@/lib/security/rate-limiter';
17ce0b2:app/api/controller/scan/route.ts:43:        const scanLimit = await RateLimiter.checkAndRecord(scanRateKey, {
17ce0b2:app/api/controller/setup/route.ts:6:import { RateLimiter } from '@/lib/security/rate-limiter';
17ce0b2:app/api/controller/setup/route.ts:41:        const { limited, remainingSeconds } = await RateLimiter.isRateLimited(rateLimitKey, { failClosed: true });
17ce0b2:app/api/controller/setup/route.ts:51:            const attempt = await RateLimiter.recordFailedAttempt(rateLimitKey, { failClosed: true });
17ce0b2:app/api/controller/setup/route.ts:141:        await RateLimiter.resetAttempts(rateLimitKey);
17ce0b2:app/api/partner/register/route.ts:5:import { RateLimiter } from '@/lib/security/rate-limiter';
17ce0b2:app/api/partner/register/route.ts:21:        const limitCheck = await RateLimiter.isRateLimited(`register_${clientIp}`);
17ce0b2:app/api/partner/register/route.ts:38:            await RateLimiter.recordFailedAttempt(`register_${clientIp}`);
17ce0b2:app/api/partner/register/route.ts:87:            await RateLimiter.recordFailedAttempt(`register_${clientIp}`);
17ce0b2:app/api/partner/register/route.ts:186:        await RateLimiter.resetAttempts(`register_${clientIp}`);
17ce0b2:app/api/partner/team/invite/route.ts:12:import { RateLimiter } from '@/lib/security/rate-limiter';
17ce0b2:app/api/partner/team/invite/route.ts:85:            RateLimiter.isRateLimited(partnerDailyRateKey, { maxAttempts: 20, windowSeconds: 86400, lockoutSeconds: 86400, failClosed: true }),
17ce0b2:app/api/partner/team/invite/route.ts:86:            RateLimiter.isRateLimited(partnerHourlyRateKey, { maxAttempts: 20, windowSeconds: 3600, lockoutSeconds: 3600 }),
17ce0b2:app/api/partner/team/invite/route.ts:87:            RateLimiter.isRateLimited(phoneRateKey, { maxAttempts: 3, windowSeconds: 86400, lockoutSeconds: 86400 }),
17ce0b2:app/api/partner/team/invite/route.ts:409:            RateLimiter.recordAttempt(partnerDailyRateKey),
17ce0b2:app/api/partner/team/invite/route.ts:410:            RateLimiter.recordAttempt(partnerHourlyRateKey),
17ce0b2:app/api/partner/team/invite/route.ts:411:            RateLimiter.recordAttempt(phoneRateKey),
17ce0b2:lib/security/rate-limiter.ts:11: * Requiert la table `rate_limits` — voir supabase/migrations/rate_limits.sql
17ce0b2:lib/security/rate-limiter.ts:25: * Requiert la table `rate_limits` — voir supabase/migrations/rate_limits.sql
17ce0b2:lib/security/rate-limiter.ts:30:export class RateLimiter {
17ce0b2:lib/security/rate-limiter.ts:53:            const { data: lockRow, error: lockErr } = await (supabase.from('rate_limits') as any)
17ce0b2:lib/security/rate-limiter.ts:70:            const { count, error: countErr } = await (supabase.from('rate_limits') as any)
17ce0b2:lib/security/rate-limiter.ts:84:                console.error(`[RateLimiter] Erreur SQL sur '${identifier}' — fail-closed activé (bloqué par sécurité):`, err);
17ce0b2:lib/security/rate-limiter.ts:94:     * et la persistance PostgreSQL dans rate_limits.
17ce0b2:lib/security/rate-limiter.ts:122:            const { data: lockRow } = await (supabase.from('rate_limits') as any)
17ce0b2:lib/security/rate-limiter.ts:136:            await (supabase.from('rate_limits') as any).insert({
17ce0b2:lib/security/rate-limiter.ts:144:                console.error(`[RateLimiter] checkAndRecord error on '${identifier}' (fail-closed):`, err);
17ce0b2:lib/security/rate-limiter.ts:159:            await (supabase.from('rate_limits') as any).insert({
17ce0b2:lib/security/rate-limiter.ts:164:            console.warn(`[RateLimiter] recordAttempt échoué pour '${identifier}':`, err);
17ce0b2:lib/security/rate-limiter.ts:197:            await (supabase.from('rate_limits') as any).insert({
17ce0b2:lib/security/rate-limiter.ts:203:            const { count, error: countErr } = await (supabase.from('rate_limits') as any)
17ce0b2:lib/security/rate-limiter.ts:216:                await (supabase.from('rate_limits') as any).insert({
17ce0b2:lib/security/rate-limiter.ts:231:                console.error(`[RateLimiter] recordFailedAttempt SQL error sur '${identifier}' (fail-closed):`, err);
17ce0b2:lib/security/rate-limiter.ts:247:            await (supabase.from('rate_limits') as any)
17ce0b2:lib/shifts/shift.service.ts:3:import { RateLimiter } from '@/lib/security/rate-limiter';
17ce0b2:lib/shifts/shift.service.ts:113:     * Protégé contre les attaques par force brute avec RateLimiter fail-closed.
17ce0b2:lib/shifts/shift.service.ts:127:        const rateCheck = await RateLimiter.isRateLimited(rateLimitKey, {
17ce0b2:lib/shifts/shift.service.ts:166:            await RateLimiter.recordFailedAttempt(rateLimitKey, {
(code de sortie 0)

$ git grep -n -E 'secret\.includes|SUPABASE_AUTH_HOOK_SECRET' 17ce0b2 -- app lib components hooks middleware.ts
17ce0b2:app/api/auth/sms-hook/route.ts:16:    if (token && (token === secret || secret.includes(token))) {
17ce0b2:app/api/auth/sms-hook/route.ts:68:        const hookSecret = process.env.SUPABASE_AUTH_HOOK_SECRET;
17ce0b2:lib/env.ts:10: *  - lib/security/totp.ts L18 : clé HMAC de dérivation = SUPABASE_AUTH_HOOK_SECRET
17ce0b2:lib/env.ts:12: *  - lib/shifts/shift.service.ts L51 : sel du PIN régisseur = SUPABASE_AUTH_HOOK_SECRET
17ce0b2:lib/env.ts:57:    SUPABASE_AUTH_HOOK_SECRET: optionalString,
17ce0b2:lib/security/totp.ts:18:    const masterKey = process.env.SUPABASE_AUTH_HOOK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'even***(35)';
17ce0b2:lib/shifts/shift.service.ts:51:    return process.env.SUPABASE_AUTH_HOOK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'even***(37)';
(code de sortie 0)
```

**Inventaire des déclencheurs publics ou faiblement protégés (avant correctif).**

| Déclencheur | Exposition | Destinataire | Protection avant | Après |
|---|---|---|---|---|
| `POST /api/auth/sms-hook` | public | libre, sans validation ; texte du code libre | un fragment du secret suffisait (`secret.includes(token)`) ; aucun contrôle sans secret | secret obligatoire, secret complet (temps constant) ou signature Standard Webhooks ± 5 min ; numéro sénégalais et code numérique validés ; garde OTP |
| `POST /api/auth/register` | public | mobile sénégalais | aucune ; SMS envoyé avant de détecter un compte existant | 409 sans SMS si numéro ou email inscrit ; garde OTP (numéro, IP) ; résultat d'envoi contrôlé |
| `POST /api/auth/send-otp` (dont mot de passe oublié) | public | mobile sénégalais | 5 / 15 min par numéro, en mémoire et en base, comptés après envoi (une rafale passait) ; aucune limite par IP | garde OTP en base, réservation atomique avant enregistrement du code ; limiteur historique retiré de la route |
| `POST /api/partner/register` | public | mobile sénégalais | limite par `x-forwarded-for` brut, comptée sur échec seulement ; SMS avant détection d'un compte existant ; 2 SMS + 1 par admin | 409 sans SMS ; garde OTP ; les SMS d'avis passent par la garde (par destinataire, plafond global) |
| `POST /api/controller/setup` | public, après OTP valide | compte coquille | limite en base, fail-closed | inchangé, la garde s'applique au SMS de confirmation |
| API publique Supabase Auth → hook | clé anon (si le fournisseur Téléphone est activé) | tout compte ayant un téléphone | celle du hook | celle du hook (garde OTP par numéro, plafond global) |
| `POST /api/partner/team/invite` | partenaire ACTIF | numéro saisi (étranger accepté) | `RateLimiter` : 20 / jour et 20 / heure par partenaire, 3 / jour par numéro, comptés après l'envoi | limites conservées ; numéro sénégalais (1C.1) ; garde CONTROLLER_INVITE (par destinataire, plafond global) |
| `POST /api/checkout` (gratuit), `POST /api/tickets/claim-free` | session | `customerPhone` libre (checkout) | aucune ; 2 SMS par appel, bornés par le stock gratuit | garde TRANSACTIONAL (par destinataire, plafond global) |
| Transfert de billet puis annulation, en boucle | session ACTIF | 8 à 15 chiffres, étrangers compris | aucune ; 2 SMS par cycle | garde TRANSACTIONAL |
| `PATCH team/assignments`, `DELETE team/controller/[id]` | partenaire ACTIF | téléphone d'un compte désigné | aucune ; SMS même sans changement | garde TRANSACTIONAL |
| `PUT /api/partner/events/[id]` (date ou lieu d'un événement publié), soumission d'événement | partenaire propriétaire | chaque acheteur, chaque admin | aucune ; un SMS par acheteur à chaque modification | garde TRANSACTIONAL |
| `POST /api/admin/communications` | admin (`communications.manage`) | jusqu'à 50 par appel, texte libre | aucune | garde TRANSACTIONAL |
| SMS sur événement métier (webhook de paiement, scan, annulation, statut de compte, transfert réclamé) | effets de bord | comptes existants | une fois par événement, en général | garde TRANSACTIONAL |

**Correctif.**
- Migration `20261031000011` : `quota_counters` (service_role uniquement) et `quota_reserve(jsonb)` : une instruction par règle (`INSERT … ON CONFLICT DO UPDATE … WHERE hits < max`), sous-transaction tout-ou-rien (une règle dépassée ne consomme aucune autre), ordre de verrouillage fixe, fenêtres fixes (jour UTC = minuit à Dakar), purge opportuniste.
- `lib/security/quota.ts` : erreur d'appel → `UNAVAILABLE` (fail-closed). `lib/sms/sms-guard.ts` : règles par catégorie, réservation consommée par l'envoi, alerte de plafond global (une par jour : `audit_logs` `SMS_GLOBAL_DAILY_CAP_REACHED` et notification in-app `SMS_DAILY_CAP_REACHED` aux SUPERADMIN, jamais par SMS). `lib/sms/mtarget.service.ts` : point d'envoi unique, plus de configuration par constructeur. Réponses : 429 `SMS_RATE_LIMITED` / `SMS_DAILY_CAP_REACHED` avec `Retry-After`, 503 `SMS_GUARD_UNAVAILABLE`.
- Limites (variables, défauts) : OTP par numéro 3 / 15 min et 10 / jour ; OTP par IP 10 / heure et 30 / jour ; tout SMS par destinataire 30 / jour ; plafond global 1 000 / jour. IP cliente : `CLIENT_IP_SOURCE` (`x-forwarded-for` première valeur, `x-real-ip` ou `none`) ; IPv6 regroupée par /64.

**parcours/sms-anti-abus**

Run 22 (avant correctif) :

```text
    not ok 1 - rafale parallèle sur un même numéro : seuls les envois sous la limite partent
        → envois acceptés : 6 (statuts 200,200,200,200,200,200)
        → 6 !== 2
    not ok 2 - même IP, numéros différents : bloquée après la limite par IP
        → statuts par envoi depuis 198.51.100.8
        → 200,
        → 200,
        → 200,
    not ok 3 - plafond global quotidien atteint : refus propre, alerte journalisée, aucun SMS
        → lecture du compteur global : Could not find the table 'public.quota_counters' in the schema cache
        → +   code: 'PGRST205',
        → +   details: null,
        → +   hint: null,
    not ok 4 - garde indisponible : refus 503 en fail-closed, aucun SMS
        → restauration du droit EXECUTE impossible : function public.quota_reserve(jsonb) does not exist
    not ok 5 - inscription d’un numéro déjà inscrit : 409, aucun SMS
        → aucun SMS envoyé à un numéro déjà inscrit
        → 1 !== 0
    not ok 6 - hook SMS de Supabase Auth : un fragment du secret est refusé, aucun SMS
        → fragment du secret : HTTP 200
        → 200 !== 401
    ok 7 - point d’envoi unique : aucun accès direct à l’adaptateur SMS hors lib/sms et lib/integrations
not ok 1 - Anti-abus SMS
# pass 1
# fail 6
```

Run 25 (après correctif) :

```text
    ok 1 - rafale parallèle sur un même numéro : seuls les envois sous la limite partent
    ok 2 - même IP, numéros différents : bloquée après la limite par IP
    ok 3 - plafond global quotidien atteint : refus propre, alerte journalisée, aucun SMS
    ok 4 - garde indisponible : refus 503 en fail-closed, aucun SMS
    ok 5 - inscription d’un numéro déjà inscrit : 409, aucun SMS
    ok 6 - hook SMS de Supabase Auth : un fragment du secret est refusé, aucun SMS
    ok 7 - hook SMS de Supabase Auth : signature Standard Webhooks valide → SMS relayé
    ok 8 - hook SMS de Supabase Auth : signature valide mais horodatage périmé (rejeu) → 401, aucun SMS
    ok 9 - point d’envoi unique : aucun accès direct à l’adaptateur SMS hors lib/sms et lib/integrations
ok 1 - Anti-abus SMS
# pass 9
# fail 0
```

**sms-formatage**

Run 22 (avant correctif) :

```text
(suite absente de ce run)
```

Run 25 (après correctif) :

```text
ok 1 - formatage MTarget : numéro local sénégalais « 77 123 45 67 »
ok 2 - formatage MTarget : numéro international « +221771234567 »
ok 3 - formatage MTarget : numéro avec espaces « +221 78 987 65 43 »
ok 4 - formatage MTarget : numéro brut avec indicatif « 221761112233 »
ok 5 - formatage MTarget : déjà au format 00221 « 00221701234567 »
ok 6 - formatage MTarget : tirets et parenthèses « (+221) 75-555-44-33 »
# pass 6
# fail 0
```

---

## 3. Filtres PostgREST construits par interpolation (1C.1)

Recherche : `.or(`, `.filter(`, `.not(`, `.match(`, `.textSearch(`, `.ilike(` / `.like(`, chaînes d'opérateurs construites à la main, gabarits sur plusieurs lignes (script de parcours complet des gabarits contenant `${`), sur `app/`, `lib/`, `components/`, `hooks/`, `scripts/` et `middleware.ts`. `postgrest-js` insère tel quel le texte de `.or()` et `.filter()` : une virgule ou une parenthèse dans la valeur ajoute une condition.

| # | Emplacement (commit `17ce0b2`) | Filtre | Origine de la valeur | Classe | Traitement |
|---|---|---|---|---|---|
| A1 | `app/api/partner/team/invite/route.ts:149` | `.or(phone.eq.${normalizedPhone},phone.eq.${phone.trim()},phone.ilike.%${suffix9})` | corps JSON, `z.string().min(8)` | saisie externe | **corrigé** : E.164 validé, `.in('phone', …)` |
| A2 | `app/api/controller/setup/route.ts:69` | même filtre | corps JSON (route publique, après OTP) | saisie externe | **corrigé** : idem |
| A3 | `app/api/admin/users/route.ts:52` | `.or(first_name.ilike.%${search}%,…)` | paramètre `search` | saisie externe (admin) | **corrigé** : `pgIlikeContains` |
| A4 | `app/api/restaurants/[id]/menu/route.ts:32` | `.or(commercial_name.ilike.%${cleanSlug}%,…)` | segment d'URL, route publique | saisie externe | **corrigé** : `pgIlikeContains` |
| A5 | `app/api/restaurants/[id]/tables/route.ts:32` | même filtre | segment d'URL, route publique | saisie externe | **corrigé** : `pgIlikeContains` |
| B1 | `lib/events/event.service.ts:201` | `.ilike('title', %${search}%)` | paramètre `search` (partenaire) | saisie externe, motif LIKE | **corrigé** : jokers échappés (`pgEscapeLike`) |
| C1 | `lib/admin/admin.service.ts:366` | `.or(phone.eq.${originalPhone},…)` | `users.phone` lu en base | valeur en base | **corrigé** par précaution : `.in('phone', […])` |
| C2 | `lib/notifications/notification.service.ts:21` | `.or('role.eq.SUPERADMIN,role.eq.ADMIN')` | constante | aucune | inchangé |
| C3 | `.filter('metadata->>…', 'eq', valeur)` (`event.service.ts:1401, 1477` ; `notification.service.ts:887-888, 999-1000, 1138-1139`) | opérateur constant `eq`, valeur passée en paramètre séparé | origine non tracée | sans effet sur la logique du filtre | inchangé : `postgrest-js` encode la valeur comme un seul paramètre d'URL, une virgule n'y ajoute pas de condition |
| D1 | `app/api/payments/[transactionId]/status/route.ts:27` | `.or(transaction_id.eq.${transactionId},external_order_id.eq.${transactionId})` | segment d'URL | saisie externe | **lot 2** (paiement), listé seulement |
| D2 | `lib/payments/payment.service.ts:500` | `.or(external_order_id.eq.${order_id},transaction_id.eq.${order_id})` | corps du webhook SamirPay, `z.string().min(1)` | saisie externe | **lot 2** (paiement), listé seulement |

Absents (vérifié) : `.textSearch(`, appels par crochets (`query['or']`), `.select(` ou `.order(` construits par gabarit, chaînes `col.eq.` concaténées avec `+`, appels directs à `rest/v1`. Les 47 `.in(` reçoivent un tableau. Le test statique `filtres-postgrest` échoue si une nouvelle interpolation brute apparaît hors paiement.

---

## 4. Secrets codés en dur (valeurs masquées)

Format : 4 premiers caractères, `***`, longueur ; `#xxxxxxxx` = 8 premiers caractères de l'empreinte SHA-256. Valeurs jamais affichées en clair, y compris dans ce rapport. `.env.local` n'a été lu que pour ses noms de variables.

| Empreinte | Valeur | Emplacements (avant le lot) | Compte ou service visé | Projet de test / service externe | Après le lot |
|---|---|---|---|---|---|
| #a109e369 | `Pass***(12)` | 109 littéraux dans 21 suites `tests/legacy` ; `tests/exploit-before.ts` (4) ; copie en clair dans `docs/lot0-inventaire-suites.md` (13) | comptes du projet de test **distant** désignés par UUID (`updateUserById` puis `signInWithPassword`), dont l'adresse de repli `fall…@gmail.com` | projet de test distant | retiré de la branche (`LEGACY_TEST_PASSWORD`), fichier supprimé, doc masquée ; **reste dans l'historique : rotation** |
| (même valeur) | `Pass***(12)` | `tests/partner-auth-complete.test.ts`, `partner-halls-m7`, `partner-orders-m9`, `ux-performance-and-double-click` | comptes neufs créés sur l'instance locale | local (valeur réutilisée) | remplacé par `TEST_PASSWORD` |
| #04445e64 | `Admi***(10)` | `scratch/create-superadmin.ts`, `scratch/test-superadmin-login.ts`, `scratch/test-phone-login.ts` | `superadmin@eventvillage.sn` / `+221770000000` | projet de test distant | supprimé avec `scratch/` ; **reste dans l'historique : rotation immédiate** |
| #70ecb282 | `Part***(12)` | `scratch/test-create-pending-partner.ts` | `contact@terangaprestige.sn` | projet de test distant | supprimé ; historique : rotation |
| #04faf353 | `Secu***(22)` | `tests/legacy/security-fixes.test.ts` | compte client distant (UUID) | projet de test distant | remplacé (`${LEGACY_TEST_PASSWORD}-original`) ; historique |
| #0a037220 | `Mali***(24)` | `tests/legacy/security-fixes.test.ts` | même compte | projet de test distant | remplacé (`${LEGACY_TEST_PASSWORD}-hacker`) ; historique |
| #ef92b778 | `pass***(11)` | `tests/legacy/partner-tables-m8.test.ts` | comptes éphémères `…@test.com` (créés sur le projet distant avant le lot 0, supposé) | projet de test distant | remplacé ; historique |
| #dd8e5286 | `cust***(15)` | `tests/legacy/mtarget-sms.test.ts` | objet de configuration factice, aucun appel | aucun | fichier supprimé |
| #fcd7c5e0 | `v1,w***(69)` | `tests/legacy/mtarget-sms.test.ts` | secret de hook **factice** (le vrai mesure 89 caractères) | aucun | fichier supprimé |
| #68196e9c | `even***(35)` | `lib/security/totp.ts` (repli), copies dans `lib/env.ts`, `docs/audit-evenementiel-annexe-constats.md`, `docs/audit-evenementiel-cdc-v3.md`, `docs/lot0-rapport.md` | clé de dérivation des QR dynamiques si aucun secret n'est défini | code de production | repli retiré (erreur si aucun secret) ; copies masquées ; historique |
| #165db3d4 | `even***(37)` | `lib/shifts/shift.service.ts` (repli), mêmes copies | sel du PIN régisseur | code de production | idem |
| #e573d9cb | `sb_publishable_…` (46) | build local `.next/` (ignoré par Git) | clé publishable du projet distant | publique par conception | non suivie ; le build de vérification utilise désormais `.env.test` |

**Hors dépôt, non suivis :** `.env.local` (secrets réels du projet de test distant, SamirPay, MTarget, Resend, hook) ; trois scripts locaux ignorés dans `scratch/`. **Valeurs factices locales, conservées :** `.env.test.example` (clés de démo publiques de la CLI Supabase, secrets marqués `test`), `TEST_PASSWORD` et `STRONG_PASSWORD` des fixtures locales, journaux `docs/lot0-logs` (valeurs par défaut de la CLI, vérifiées par empreinte). **Aucun identifiant réel de SamirPay, MTarget ou Resend** n'est écrit dans le dépôt. Le vrai secret du hook figure encore sur `main` (rapport du lot 1A) : à faire tourner.

Vérification statique du lot (sur l'arbre des correctifs) : `tests/schema/secrets-codes-en-dur.test.ts` (section 2, 1C.6) et, sur l'état rouge, 137 occurrences de littéraux détectées dans `tests/` :

```text
$ node scan-passwords.js 17ce0b2
révision 17ce0b2
regex du test secrets-codes-en-dur : 137 occurrence(s)
  tests/exploit-before.ts : 4
  tests/legacy/admin-anonymize.test.ts : 1
  tests/legacy/cdc-v3-validation-checks.test.ts : 1
  tests/legacy/checkout-mixed-cart.test.ts : 2
  tests/legacy/client-ticket-lifecycle.test.ts : 6
  tests/legacy/controller-14-points.test.ts : 10
  tests/legacy/controller-complete-workflow.test.ts : 2
  tests/legacy/controller-event-status-hotfix.test.ts : 6
  tests/legacy/controller-multi-role.test.ts : 8
  tests/legacy/controller-realtime-sync.test.ts : 4
  tests/legacy/controller-shifts-z.test.ts : 6
  tests/legacy/dynamic-qr-totp.test.ts : 6
  tests/legacy/mtarget-sms.test.ts : 1
  tests/legacy/partner-events-m5.test.ts : 13
  tests/legacy/partner-tables-m8.test.ts : 6
  tests/legacy/scanner-security-hardening.test.ts : 4
  tests/legacy/security-fixes.test.ts : 6
  tests/legacy/ticket-pdf-and-exports.test.ts : 4
  tests/legacy/ticket-scanned-notifications.test.ts : 2
  tests/legacy/ticket-stock-lifecycle.test.ts : 8
  tests/legacy/ticket-transfer-phase2-initiation.test.ts : 4
  tests/legacy/ticket-transfer-phase3-claim.test.ts : 6
  tests/legacy/ticket-transfers-phase1-schema.test.ts : 4
  tests/legacy/ticketing-e2e-final.test.ts : 8
  tests/partner-auth-complete.test.ts : 2
  tests/partner-halls-m7.test.ts : 8
  tests/partner-orders-m9.test.ts : 2
  tests/ux-performance-and-double-click.test.ts : 3

$ node scan-passwords.js HEAD
révision HEAD
regex du test secrets-codes-en-dur : 0 occurrence(s)
```

---

## 5. Suites legacy touchées

Les suites de `tests/legacy/` sont en quarantaine depuis le lot 0 (non exécutées par `npm run test`).

**Supprimée :**
- `tests/legacy/mtarget-sms.test.ts` : le cas 7 instanciait `MTargetService` avec une configuration, retirée au 1C.9 (configuration par l'environnement uniquement) ; les cas 8 et 9 appelaient le hook SMS sans authentification, ce qui est désormais refusé (contrat couvert par `tests/parcours/sms-anti-abus.test.ts`). Les cas 1 à 6 (formatage des numéros, purs) sont repris et exécutés dans `tests/sms-formatage.test.ts`.

**Réécrites (mots de passe, 1C.6) :** 22 suites, littéraux remplacés par `process.env.LEGACY_TEST_PASSWORD` (aucune valeur dans le dépôt) : `admin-anonymize`, `cdc-v3-validation-checks`, `checkout-mixed-cart`, `client-ticket-lifecycle`, `controller-14-points`, `controller-complete-workflow`, `controller-event-status-hotfix`, `controller-multi-role`, `controller-realtime-sync`, `controller-shifts-z`, `dynamic-qr-totp`, `partner-events-m5`, `partner-tables-m8`, `scanner-security-hardening`, `security-fixes`, `ticket-pdf-and-exports`, `ticket-scanned-notifications`, `ticket-stock-lifecycle`, `ticket-transfer-phase2-initiation`, `ticket-transfer-phase3-claim`, `ticket-transfers-phase1-schema`, `ticketing-e2e-final`.

**Contrat modifié par le lot, à réécrire quand elles sortiront de quarantaine** (non exécutées ici, donc non prouvées en échec) :

| Suite | Ligne | Dépendance au contrat d'avant |
|---|---|---|
| `controller-14-points` | 460, 467 | lit `otp_codes.code` (colonne supprimée, 1C.4) et `otp_code` dans la réponse d'invitation (retiré, 1C.1) |
| `controller-multi-role` | 217-219 | attend `existing_user.id` et le rôle en clair (masqués, 1C.1) |
| `security-fixes` | 190-191, 492 | insère un code en clair dans `otp_codes` (1C.4) ; le cas 492 vérifie déjà l'absence d'`otp_code` |
| `controller-event-status-hotfix`, `scanner-security-hardening` | 236, 337 | appellent l'invitation avec des numéros et emails de comptes distants (contrat 1C.1) |
| `admin-anonymize` | — | l'anonymisation révoque aussi les sessions (1C.3) : sans effet sur ses assertions |

---

## 6. Sortie brute de `npm run verify` et CI

Run de référence : **https://github.com/fallouu-mn/event-village/actions/runs/41223947446** (run 25, commit `695af3d`). Sortie complète : `docs/lot1c-logs/ci-run25-verify.log` ; run rouge de référence : `docs/lot1c-logs/ci-run22-verify.log`.

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

[run-tests] 49 suite(s) — garde-fou : tests/helpers/env.ts — délai/suite : 600.0s
[… 2810 lignes de sortie des suites, intégralement dans docs/lot1c-logs/ci-run25-verify.log …]
═══════════════════ RÉCAPITULATIF ═══════════════════
Suite                                           Statut   Durée     Code  Journal
tests/auth-rbac.test.ts                         PASS     195ms     0     .test-logs/tests__auth-rbac.test.ts.log
tests/e2e-scenarios.test.ts                     PASS     336ms     0     .test-logs/tests__e2e-scenarios.test.ts.log
tests/fondations-lot0.test.ts                   PASS     316ms     0     .test-logs/tests__fondations-lot0.test.ts.log
tests/notifications-and-documents.test.ts       PASS     147ms     0     .test-logs/tests__notifications-and-documents.test.ts.log
tests/parcours/achat-serveur.test.ts            PASS     552ms     0     .test-logs/tests__parcours__achat-serveur.test.ts.log
tests/parcours/anonymisation-debogage.test.ts   PASS     575ms     0     .test-logs/tests__parcours__anonymisation-debogage.test.ts.log
tests/parcours/attribution-roles.test.ts        PASS     937ms     0     .test-logs/tests__parcours__attribution-roles.test.ts.log
tests/parcours/bootstrap-superadmin.test.ts     PASS     417ms     0     .test-logs/tests__parcours__bootstrap-superadmin.test.ts.log
tests/parcours/changement-role-admin.test.ts    PASS     775ms     0     .test-logs/tests__parcours__changement-role-admin.test.ts.log
tests/parcours/documents-inscription.test.ts    PASS     1.6s      0     .test-logs/tests__parcours__documents-inscription.test.ts.log
tests/parcours/email-optionnel.test.ts          PASS     745ms     0     .test-logs/tests__parcours__email-optionnel.test.ts.log
tests/parcours/filtres-postgrest.test.ts        PASS     387ms     0     .test-logs/tests__parcours__filtres-postgrest.test.ts.log
tests/parcours/invitation-identite.test.ts      PASS     1.2s      0     .test-logs/tests__parcours__invitation-identite.test.ts.log
tests/parcours/otp-hachage.test.ts              PASS     352ms     0     .test-logs/tests__parcours__otp-hachage.test.ts.log
tests/parcours/otp-serveur.test.ts              PASS     803ms     0     .test-logs/tests__parcours__otp-serveur.test.ts.log
tests/parcours/pin-regisseur.test.ts            PASS     321ms     0     .test-logs/tests__parcours__pin-regisseur.test.ts.log
tests/parcours/realtime-scanner.test.ts         PASS     14.7s     0     .test-logs/tests__parcours__realtime-scanner.test.ts.log
tests/parcours/revocation-sessions.test.ts      PASS     1.4s      0     .test-logs/tests__parcours__revocation-sessions.test.ts.log
tests/parcours/roles-fraicheur.test.ts          PASS     701ms     0     .test-logs/tests__parcours__roles-fraicheur.test.ts.log
tests/parcours/roles-metadonnees.test.ts        PASS     483ms     0     .test-logs/tests__parcours__roles-metadonnees.test.ts.log
tests/parcours/sms-anti-abus.test.ts            PASS     468ms     0     .test-logs/tests__parcours__sms-anti-abus.test.ts.log
tests/parcours/statut-compte.test.ts            PASS     1.8s      0     .test-logs/tests__parcours__statut-compte.test.ts.log
tests/partner-auth-complete.test.ts             PASS     340ms     0     .test-logs/tests__partner-auth-complete.test.ts.log
tests/partner-halls-m7.test.ts                  PASS     900ms     0     .test-logs/tests__partner-halls-m7.test.ts.log
tests/partner-orders-m9.test.ts                 PASS     1.0s      0     .test-logs/tests__partner-orders-m9.test.ts.log
tests/payment.test.ts                           PASS     148ms     0     .test-logs/tests__payment.test.ts.log
tests/roles-isolation.test.ts                   PASS     163ms     0     .test-logs/tests__roles-isolation.test.ts.log
tests/scanner-combat-ui.test.ts                 PASS     285ms     0     .test-logs/tests__scanner-combat-ui.test.ts.log
tests/scanner-wolof-audio.test.ts               PASS     281ms     0     .test-logs/tests__scanner-wolof-audio.test.ts.log
tests/schema/fonctions-privileges.test.ts       PASS     213ms     0     .test-logs/tests__schema__fonctions-privileges.test.ts.log
tests/schema/hotfix-identique.test.ts           PASS     162ms     0     .test-logs/tests__schema__hotfix-identique.test.ts.log
tests/schema/hotfix-scripts.test.ts             PASS     289ms     0     .test-logs/tests__schema__hotfix-scripts.test.ts.log
tests/schema/rls-toutes-tables.test.ts          PASS     179ms     0     .test-logs/tests__schema__rls-toutes-tables.test.ts.log
tests/schema/secrets-codes-en-dur.test.ts       PASS     196ms     0     .test-logs/tests__schema__secrets-codes-en-dur.test.ts.log
tests/security/anon-uniquement.test.ts          PASS     161ms     0     .test-logs/tests__security__anon-uniquement.test.ts.log
tests/security/r1-inscription-roles.test.ts     PASS     1.0s      0     .test-logs/tests__security__r1-inscription-roles.test.ts.log
tests/security/r10-user-roles.test.ts           PASS     479ms     0     .test-logs/tests__security__r10-user-roles.test.ts.log
tests/security/r11-storage-documents.test.ts    PASS     503ms     0     .test-logs/tests__security__r11-storage-documents.test.ts.log
tests/security/r2-otp-codes.test.ts             PASS     334ms     0     .test-logs/tests__security__r2-otp-codes.test.ts.log
tests/security/r3-fonctions-rpc.test.ts         PASS     397ms     0     .test-logs/tests__security__r3-fonctions-rpc.test.ts.log
tests/security/r4-ecritures-directes.test.ts    PASS     400ms     0     .test-logs/tests__security__r4-ecritures-directes.test.ts.log
tests/security/r5-lectures-anon.test.ts         PASS     351ms     0     .test-logs/tests__security__r5-lectures-anon.test.ts.log
tests/security/r6-roles-jeton.test.ts           PASS     524ms     0     .test-logs/tests__security__r6-roles-jeton.test.ts.log
tests/security/r7-profil-colonnes.test.ts       PASS     561ms     0     .test-logs/tests__security__r7-profil-colonnes.test.ts.log
tests/security/r8-controleur-lectures.test.ts   PASS     371ms     0     .test-logs/tests__security__r8-controleur-lectures.test.ts.log
tests/security/r9-partenaire-ecritures.test.ts  PASS     377ms     0     .test-logs/tests__security__r9-partenaire-ecritures.test.ts.log
tests/sms-formatage.test.ts                     PASS     235ms     0     .test-logs/tests__sms-formatage.test.ts.log
tests/superadmin-complete.test.ts               PASS     259ms     0     .test-logs/tests__superadmin-complete.test.ts.log
tests/ux-performance-and-double-click.test.ts   PASS     522ms     0     .test-logs/tests__ux-performance-and-double-click.test.ts.log
──────────────────────────────────────────────────────
TOTAL : 49 suite(s) — 49 réussie(s), 0 en échec, 0 expirée(s)

═══════════════ verify › build : npm run build ═══════════════

> event-village@1.0.0 build
> next build

  ▲ Next.js 14.2.35
  - Experiments (use with caution):
    · instrumentationHook

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
    at o (/home/runner/work/event-village/event-village/.next/server/chunks/8272.js:1:12587)
    at l (/home/runner/work/event-village/event-village/.next/server/chunks/3138.js:1:920)
    at d (/home/runner/work/event-village/event-village/.next/server/chunks/3138.js:1:445)
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
├ ○ /admin/users                                        25.1 kB         142 kB
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
├ ○ /forgot-password                                    8.87 kB         194 kB
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
├ ƒ /partner/events/[id]/team                           5.03 kB         182 kB
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
├ ○ /partner/team                                       9.35 kB         187 kB
├ ○ /profile                                            6.95 kB         179 kB
├ ○ /register                                           9.09 kB         194 kB
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


ƒ Middleware                                            87.6 kB

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand


[verify] OK — 4 étapes réussies en 92s.
```

| Run | Commit | Résultat | Rôle |
|---|---|---|---|
| [21 · 41219265763](https://github.com/fallouu-mn/event-village/actions/runs/41219265763) | 7735a95 | échec attendu | premiers tests rouges du lot : 10 suites en échec sur 48, 1 expirée (`sms-anti-abus` : connexion pg restée ouverte, voir section 1) |
| [22 · 41220786082](https://github.com/fallouu-mn/event-village/actions/runs/41220786082) | 17ce0b2 | échec attendu | **référence « avant »** : tests finals, aucun correctif ; 11 suites en échec sur 48, aucune expirée |
| [23 · 41222902093](https://github.com/fallouu-mn/event-village/actions/runs/41222902093) | 4b3bebe | échec | correctifs 1C.1 à 1C.9 : 47 suites sur 49 ; `documents-inscription` (propriétaire au statut EN_ATTENTE refusé), `notifications-and-documents` (contrôle statique de l'ancien appel du tableau de bord) |
| [24 · 41223479825](https://github.com/fallouu-mn/event-village/actions/runs/41223479825) | f73ce86 | échec | 48 sur 49 ; `statut-compte` : contrôle statique du lot 1B.6, la route `signed-url` ne passait plus par `requireActiveSession` |
| [25 · 41223947446](https://github.com/fallouu-mn/event-village/actions/runs/41223947446) | 695af3d | succès | **référence « après »** : 49 suites vertes sur 49 ; `signed-url` repasse par `requireActiveSession` (option `allowStatuses`) |

---

## 7. Points ouverts

1. **Rotation des secrets présents dans l'historique Git** (section 4), en priorité le mot de passe du compte superadmin du projet de test distant et le vrai secret du hook (sur `main`). Le projet de test distant doit être abandonné ou ses comptes réinitialisés ; réécrire l'historique d'un dépôt public ne rend pas les valeurs secrètes.
2. **Filtres du paiement** (D1, D2) : à corriger au lot 2.
3. **IP cliente** : `CLIENT_IP_SOURCE=x-forwarded-for` n'est fiable que derrière un hébergeur qui réécrit l'en-tête (Vercel). Ailleurs, un client peut changer d'IP apparente à chaque requête : seules les limites par numéro et le plafond global tiennent. À fixer avec l'hébergement du client.
4. **Valeurs des limites SMS** : défauts prudents (section 2, 1C.9) à valider avec le client selon son budget MTarget ; le plafond global bloque **tous** les SMS (OTP compris) une fois atteint.
5. **Déclencheurs authentifiés sans limite par compte** (checkout gratuit, boucle de transfert, modification d'un événement publié, affectations) : ils ne sont bornés que par destinataire et par le plafond global. Un compte abusif peut donc épuiser le plafond du jour et bloquer les OTP de tous. À compléter : limite par compte déclencheur et part du plafond réservée aux OTP. Ajout aussi d'un contrôle « statut inchangé » sur `admin/partners/[id]/status`, qui renvoie le SMS à chaque appel.
6. **Fournisseur Téléphone de Supabase Auth** : l'application n'utilise ni `signInWithOtp` ni `resend` par téléphone. Le désactiver dans le projet de production si le hook n'est pas nécessaire (§6 de `docs/deploiement-projet-neuf.md`).
7. **Limiteur historique `RateLimiter`** (`lib/security/rate-limiter.ts`) : retiré de `send-otp`, encore utilisé par `auth/resolve-phone`, `auth/verify-otp`, `controller/scan`, `controller/setup`, `partner/register` (clé sur `x-forwarded-for` brut), `partner/team/invite` et `lib/shifts/shift.service.ts`, avec ses défauts (contrôle et enregistrement séparés, erreurs ignorées). À remplacer par `reserveQuota` dans un lot ultérieur.
8. **Contrôleurs invités avant ce lot** : leur email de connexion reste celui saisi par le partenaire. À revoir au cas par cas (aucune donnée de production à ce jour).
9. **OTP** : un seul usage par numéro (pas de colonne « objet du code ») ; un code d'inscription pourrait servir à une autre vérification du même numéro dans ses 10 minutes. Ajouter une colonne `purpose` au lot des comptes.
10. **Jeton d'accès** après révocation : valable jusqu'à son expiration (1 h au plus). Réduire `jwt_expiry` si le client l'exige.
11. **1C.7** : réservation de salle en production sans verrou ni traduction d'erreur (section 2) ; à traiter dans le lot des salles, avec un test sur la route réelle.
12. **`partners` en lecture REST** : les chemins de pièces y restent lisibles selon les politiques existantes ; ils ne donnent plus accès à rien (Storage fermé, URL signée sur dossier uniquement), mais la colonne pourrait être retirée de la lecture publique.
13. **Changement de téléphone ou d'email** (point ouvert n° 4 du lot 1B) : hors des tâches du lot 1C ; toujours bloqué par REST, route serveur avec OTP à créer quand l'interface le proposera.

Le lot 2 n'a pas été commencé.
