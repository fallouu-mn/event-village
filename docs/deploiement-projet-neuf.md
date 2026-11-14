# Déploiement — montage du futur projet de production depuis zéro

**Statut :** procédure préparée au lot 1A, complétée à chaque lot (dernière mise à jour : lot 9 ter, écritures REST fermées, zones et portes, liste des invités, tableau de bord des entrées, stock au public, migrations `20261110…`, section 3 sexies ; avant lui, lot 9 bis, migrations `20261109…`, section 3 quinquies). **À ne pas exécuter maintenant** : elle sera déroulée quand l'hébergeur de l'application sera choisi. Le projet monté le 02/11 est devenu event-village-dev, le projet d'essai manuel : il suit `docs/essai-local.md`, et la production se fera sur un projet neuf.

**Principe :** la production se fait sur un projet Supabase **neuf**. On n'y copie rien du projet de test : ni données, ni comptes, ni clés. Le schéma vient uniquement des migrations du dépôt.

**Commandes :** partout où ce document écrit `<quelque chose>`, remplacez tout le bloc, chevrons compris. Sous PowerShell, une commande qui garde `<` ou `>` échoue.

---

## 1. Pré-requis

- Branche du dépôt validée (CI verte : `npm run verify`).
- Supabase CLI à la version figée dans `.github/workflows/verify.yml`.
- Accès administrateur au compte Supabase de l'organisation, aux comptes SamirPay, MTarget et Resend de production.
- Un poste de confiance pour l'opérateur. Les secrets ne transitent ni par le dépôt, ni par un chat, ni par une capture d'écran.

## 2. Créer le projet

1. Créer un nouveau projet Supabase dans l'organisation, région la plus proche de Dakar, mot de passe de base généré et conservé dans le gestionnaire de secrets.
2. Dans **Authentication > Providers** :
   - email : activé ; « Confirm email » : **activé** ;
   - inscription publique : **coupée** (lot 9 quater, A2 : AUD-01, AUD-03, G-36). Dans **Authentication > Sign In / Providers**, section « User Signups », décocher **« Allow new users to sign up »**, puis enregistrer. C'est le pendant de `[auth] enable_signup = false` de `supabase/config.toml`. Tous les comptes de l'application sont créés par les routes serveur avec la clé service (inscription client et partenaire, invitation de contrôleur, création par un admin, amorçage du SUPERADMIN), que ce réglage ne bloque pas. Ne pas couper le fournisseur « Email » lui-même : il sert à la connexion par mot de passe ;
     vérification, depuis un poste quelconque, avec la seule clé publique (`anon`) : `curl -s -X POST "https://<ref>.supabase.co/auth/v1/signup" -H "apikey: <clé anon>" -H "Content-Type: application/json" -d '{"email":"essai-inscription@exemple.invalid","password":"Essai#2026x"}'` doit répondre une erreur `signup_disabled` (« Signups not allowed for this instance »), et aucune ligne ne doit apparaître dans **Authentication > Users** ;
   - fournisseur email, **« Secure password change »** : **activé** (lot 9 quater, A3 : AUD-02, G-04 ; pendant de `[auth.email] secure_password_change = true`). Vérification : la case reste cochée après rechargement de la page. Ce réglage n'exige le mot de passe actuel que pour une session de plus de 24 heures ; la vraie barrière est en base (trigger `auth_users_guard_writes`, migration `20261111000001`), qui refuse tout changement de mot de passe sans permis à usage unique délivré par une route de l'application ;
   - téléphone : **désactivé**, comme en local et en CI (`[auth.sms] enable_signup = false`). Les comptes sont créés par les routes serveur (`auth.admin.createUser`, téléphone et email déjà confirmés) et les codes SMS partent par MTarget depuis l'application ; Supabase n'envoie aucun SMS, le hook SMS (6 bis) n'est donc à configurer que si le fournisseur téléphone est un jour activé.
   - **longueur minimale du mot de passe : 10** (lot 9 quinquies, A7 : AUTH-11 ; pendant de `minimum_password_length = 10` de `supabase/config.toml`), sans exigence de composition (« Password requirements » : aucune). Dans **Authentication > Sign In / Providers**, fournisseur Email, champ « Minimum password length ». La règle complète (64 caractères au plus, mots de passe courants refusés) est appliquée par l'application ;
   - **SMTP de Supabase : inutile** (lot 9 quinquies, B2 : AUTH-08, T5). Supabase Auth n'envoie plus aucun email : le lien « Mot de passe oublié » part de l'application par Resend (`POST /api/auth/forgot-password`, même expéditeur que les autres emails), comme le lien de vérification d'adresse. La base refuse à GoTrue tout code ou lien email qui ne vient pas d'une route de l'application (trigger `auth_users_guard_writes`, migration `20261112000010`). Ne rien configurer dans **Authentication > Emails > SMTP Settings**.
3. Dans **Authentication > Rate limits** : conserver les valeurs par défaut de Supabase (la valeur relevée de `supabase/config.toml` ne concerne que l'instance locale de test).
4. Ne créer **aucune** fonction, table ni politique à la main dans l'éditeur SQL. Tout passe par les migrations (étape 3). Une fonction créée à la main échappe aux tests de privilèges (c'est ainsi qu'`exec_sql` est apparue sur le projet de test). Seules exceptions, prévues et versionnées : les scripts d'exploitation de `supabase/ops/` (planification, section 7), qui ne créent ni table ni fonction de `public`.

## 3. Appliquer le schéma depuis zéro

Sur un projet neuf, l'historique de migrations est vide : `db push` applique tout, dans l'ordre.

```bash
supabase link --project-ref <ref-du-projet-de-production>
supabase db push --dry-run     # relire la liste : toutes les migrations du dépôt, rien d'autre
supabase db push
```

Puis exécuter `supabase/hotfix/2026-10-31-lot1a/03-verification.sql` dans l'éditeur SQL : **toutes** les lignes doivent être `OK`. Sur un projet neuf, cette vérification doit passer sans appliquer `02-hotfix.sql` (la migration du lot 1A est déjà incluse). Depuis le lot 7, le script attend **7** aides RLS (la 7e est `ticket_category_private_read`, migration `20261105000003`) : exécuté avant les migrations du lot 7, il signale à tort la ligne « 1A.3 aides RLS exécutables par anon et authenticated, STABLE, search_path fixé ».

Les migrations ne créent ni pg_cron ni pg_net et ne planifient aucune tâche (décision 55 du lot 6, contrôlée par `tests/schema/planification-crons.test.ts`) : la planification est une étape à part (section 7). Les lots 7, 8, 9 et 9 bis n'ajoutent ni ne changent aucune tâche planifiée.

## 3 bis. Projet déjà en service : appliquer seulement les migrations du lot 7

Cas du projet de production monté le 02/11 : les migrations jusqu'au lot 6 compris (`20261103000001` à `20261103000008`) y sont déjà appliquées. Elles sont **gelées** : aucune n'est modifiée dans le dépôt, et aucune ne doit être rejouée. Le lot 7 apporte sept migrations nouvelles, à appliquer dans cet ordre (l'ordre des noms, celui que suit `db push`).

| Ordre | Migration | Ce qu'elle fait |
|---|---|---|
| 1 | `20261105000001_lot7_reglages.sql` | Crée les 5 réglages du lot (section 4 bis et 4 ter) : `notif.sms_optional_daily_cap` (700), `notif.free_ticket_reminder_sms` (`NEVER`), `features.halls_enabled`, `features.tables_enabled`, `features.orders_enabled` (`false`). Supprime `notif.sms_daily_alert` (suppression historisée dans `platform_settings_history`). Recrée `fin_setting_valid` et `finance_setting_set` avec ces clés. Un ADMIN ne peut pas écrire une clé `features.*` par l'API REST : seul un SUPERADMIN actif la change, par la page Réglages. |
| 2 | `20261105000002_lot7_sms.sql` | Budget des SMS optionnels, appliqué au moment où l'envoyeur réserve une ligne de la boîte d'envoi (`notification_outbox_claim`), sous verrou, par jour de Dakar. Alerte des administrateurs à 80 % de ce budget, une fois par jour (`notification_daily_checks`). Prévision de la veille (`notification_reminders_schedule`) : si les rappels SMS prévus pour le lendemain dépassent le budget restant, alerte une fois par jour. Rappels sans SMS pour un porteur qui n'a que des billets gratuits ou des invitations, quand le réglage vaut `NEVER`. Nouveaux types `ADMIN_SMS_OPTIONAL_80` et `ADMIN_SMS_FORECAST`, signaux `SMS_OPTIONAL_80` et `SMS_FORECAST`. Statistiques de la page Notifications de l'administration (`admin_notifications_stats`). Lit les clés de la migration 1. |
| 3 | `20261105000003_lot7_securite.sql` | Nouvelle aide RLS `ticket_category_private_read` : les politiques de `ticket_categories` ne lisent plus `public.users` sous le rôle du visiteur. `event_cancel` verrouille les transferts en attente et les billets de l'événement avant de prévenir les porteurs. `ticket_transfer_accept` et `ticket_transfer_claim` refusent un transfert sur un événement ni publié ni validé (`EVENT_NOT_ACTIVE`). Le type inutilisé `notification_channel_enum` est supprimé. |
| 4 | `20261105000004_lot7_billet_hors_ligne.sql` | Historique des versions du secret des billets (`ticket_secret_versions`), avec une ligne de reprise (`BACKFILL`) pour **chaque billet existant**. Triggers sur `tickets` : la version avance d'une unité (avec un nouveau secret) au transfert, à l'annulation, au remboursement et à la régénération, et chaque avancée est historisée ; une version qui saute est refusée ; le passage de `VALIDE` à `UTILISE` ne la change pas. Les codes hors ligne d'une ancienne version sont alors refusés au scan. Journal des téléchargements de codes hors ligne (`ticket_offline_downloads`), sans aucun code ni secret. Fonctions `ticket_secret_rotate`, `ticket_offline_window`, `ticket_offline_grant`, `ticket_offline_info`. |
| 5 | `20261105000005_lot7_scan.sql` | Colonnes `ticket_scans.secret_version` et `ticket_scans.client_key` (clé d'idempotence, unique par scanneur). `scan_log` change de signature. `ticket_scan` : une même clé rejouée rend le verdict d'origine sans nouvelle entrée ; la version du secret présentée est contrôlée sous le verrou du billet, et un QR sans version est refusé. `ticket_cash_checkin` : encaissement rejouable par le même contrôleur. Nouvelles fonctions `controller_scan_stats`, `ticket_manual_lookup`, `counter_sale_quote`. |
| 6 | `20261105000006_lot7_client.sql` | `checkout_create_payment` refuse un second paiement de billets en attente, non échu, du même compte pour le même événement (`PAYMENT_PENDING`). Suppression des politiques d'insertion REST `hall_reservations_insert`, `table_reservations_insert`, `orders_insert` : ces écritures passent toutes par les routes serveur. |
| 7 | `20261105000007_lot7_confirmation.sql` | `notif_ticket_lines` : catégories, quantités et 10 premiers numéros de billets, figés dans la confirmation au moment de l'achat. `payment_confirm`, `free_tickets_claim` et `ticket_transfer_accept` (dans sa version de la migration 3) les ajoutent aux données de `PURCHASE_CONFIRMED`, `FREE_TICKETS_CONFIRMED` et `TRANSFER_RECEIVED`. `TRANSFER_RECEIVED` reçoit le canal email. Dépend de la migration 3. |

Toutes sont rejouables (gardes `IF [NOT] EXISTS`, `CREATE OR REPLACE`, `ON CONFLICT DO NOTHING`), sans `BEGIN` ni `COMMIT`. Chaque fonction créée ou recréée est `SECURITY DEFINER`, réservée au service_role, sauf l'aide RLS `ticket_category_private_read`.

**Contrôle avant d'appliquer : aucune migration `20261103…` ne doit repartir.**

1. Dans l'éditeur SQL du projet, relever l'historique :

   ```sql
   -- attendu : 8 lignes, 20261103000001 à 20261103000008
   select version from supabase_migrations.schema_migrations where version like '20261103%' order by version;

   -- attendu : aucune ligne avant le lot 7
   select version from supabase_migrations.schema_migrations where version like '20261105%' order by version;
   ```

2. Depuis le poste de l'opérateur :

   ```bash
   supabase link --project-ref <ref-du-projet-de-production>
   supabase migration list        # colonnes Local et Remote : 20261103000001 à …08 présents des deux côtés
   supabase db push --dry-run     # doit lister exactement les 7 fichiers 20261105000001 à …07, dans cet ordre
   ```

3. **Si la liste du `--dry-run` contient autre chose** (une migration `20261103…` ou plus ancienne) : s'arrêter. L'historique du projet ne correspond pas aux migrations réellement appliquées. Ne pas ajouter `--include-all`, ne modifier aucune migration gelée, et ne pas lancer `supabase migration repair` sans avoir d'abord comparé le schéma réel à la migration en cause.

4. Sinon, appliquer : `supabase db push`. Puis relancer la première requête : 8 lignes `20261103…` (inchangées) ; la seconde : 7 lignes `20261105…`. Enfin, exécuter `03-verification.sql` : tout `OK`.

**Déployer l'application du lot 7 dans la même fenêtre de maintenance, en dehors de tout contrôle d'entrée.** Après la migration 5, un QR doit porter la version de son secret : la route de scan du lot 6 ne l'envoie pas, et chacun de ses scans de QR serait refusé (« QR expiré »). Inversement, l'application du lot 7 appelle des fonctions qui n'existent qu'après les migrations (codes hors ligne, chiffres du contrôleur, saisie manuelle, devis du guichet).

## 3 ter. Projet déjà en service : appliquer seulement les migrations du lot 8

Cas d'un projet où les migrations jusqu'au lot 7 compris (`20261105000001` à `20261105000007`) sont déjà appliquées. Sur un projet neuf, la section 3 suffit : `db push` applique tout. Le projet d'essai event-village-dev suit `docs/essai-local.md`, section 3. Les migrations `20261103…` et `20261105…` sont **gelées**. Le lot 8 apporte six migrations nouvelles, à appliquer dans cet ordre, celui des noms, que suit `db push`.

| Ordre | Migration | Ce qu'elle fait |
|---|---|---|
| 1 | `20261106000001_lot8_canaux.sql` | Deux réglages par catégorie : `sale_online` (vendue en ligne) et `sale_counter` (vendue au guichet). `is_visible` reste, comme miroir de `sale_online`. Reprise sans changement de comportement : `sale_online` = `is_visible`, `sale_counter` = vrai. Contrôle en base : achat en ligne refusé (`CATEGORY_NOT_SOLD_ONLINE`, par `ticket_sale_problems`), vente au guichet refusée (`CATEGORY_NOT_SOLD_AT_COUNTER`, par `counter_sale` et `counter_sale_quote`). La décision est figée à la vente : `stock_reservations.sale_online_at_checkout` et `tickets.sale_decision`, immuable. Un bloc de contrôle arrête la migration, avec un message en français, si une catégorie masquée a un maximum par commande hors de 1 à 50 ou un prix décimal. |
| 2 | `20261106000002_lot8_essai.sql` | Colonnes `payments.simulated` et `cashouts.simulated`, immuables, posées par trigger d'après l'en-tête `x-ev-simulation`, que seul un serveur d'essai envoie. Une opération simulée ne peut pas partir en réel, ni l'inverse. **Aucun effet en production** : l'en-tête n'y est jamais envoyé, et toutes les lignes restent à faux. |
| 3 | `20261106000003_lot8_paiement.sql` | Second paiement réussi d'un même panier : remboursé par le module de cashout, sans billet, ni vente, ni commission, avec l'avis `REFUND_PAID` au client et l'alerte `ADMIN_DUPLICATE_PAYMENT`, nouveau type de notification. Ordre unique des verrous dans `payment_confirm` et `event_cancel` (événement, paiements, catégories, transferts, billets), qui supprime leur interblocage. Conséquence : deux confirmations d'un même événement passent l'une après l'autre. `notif_payments_other_success` transmet `payment_target`, pour que l'avis de paiement d'un abonnement mène à `/partner/subscription`. Dépend de `20261105000003` et `20261105000007`. |
| 4 | `20261106000004_lot8_commissions.sql` | Plafond des commissions de parrainage : N1 = min(calcul, revenu net d'Event Village), N2 = min(calcul, net − N1), même budget au remboursement partiel. Nouvelle colonne `referral_commissions.uncapped_amount` : montant calculé d'une ligne plafonnée, NULL sinon. La grille ne change pas. |
| 5 | `20261106000005_lot8_scan.sql` | `ticket_scan` accepte `replay_only` dans ses paramètres : un scan repris après une sortie de l'application ne rend que le verdict d'une ligne existante (`not_processed` sinon) et ne crée jamais d'entrée. Signature inchangée. |
| 6 | `20261106000006_lot8_profil.sql` | Nouvelle fonction `partner_profile_update` : la fiche et les activités du partenaire s'enregistrent en une seule transaction. |

Aucune ne crée de table, de réglage ni de tâche planifiée, aucune n'ajoute d'aide RLS. Toutes sont rejouables, sans `BEGIN` ni `COMMIT` de transaction, et chaque fonction créée ou recréée est `SECURITY DEFINER`, réservée au service_role.

**Contrôles avant d'appliquer :**

1. Depuis le poste de l'opérateur :

   ```bash
   supabase link --project-ref <ref-du-projet>
   supabase migration list        # 20261105000007 présent des deux côtés, les six 20261106… en local seulement
   supabase db push --dry-run     # doit lister exactement les 6 fichiers 20261106000001 à …06, dans cet ordre
   ```

2. **Si la liste contient autre chose** : même règle qu'en 3 bis. S'arrêter, sans `--include-all` et sans `supabase migration repair`.

3. Dans l'éditeur SQL, le contrôle de la reprise. Attendu : 0 et 0. Sinon, corriger ces catégories avant `db push`.

   ```sql
   select count(*) filter (where max_per_order not between 1 and 50) as maximum_hors_regle,
          count(*) filter (where price <> trunc(price)) as prix_decimal
     from public.ticket_categories
    where not is_visible;
   ```

4. Appliquer : `supabase db push`. Puis exécuter `03-verification.sql` : tout `OK`. La liste blanche des aides RLS reste à 7.

**Déployer l'application du lot 8 dans la même fenêtre de maintenance, en dehors de tout contrôle d'entrée.** Elle lit des colonnes et appelle une fonction qui n'existent qu'après ces migrations (`sale_online`, `sale_counter`, `cashouts.simulated`, `partner_profile_update`).

## 3 quater. Projet déjà en service : appliquer seulement les migrations du lot 9

Cas d'un projet où les migrations jusqu'au lot 8 compris (`20261106000001` à `20261106000006`) sont déjà appliquées. Sur un projet neuf, la section 3 suffit : `db push` applique tout. Le projet d'essai event-village-dev suit `docs/essai-local.md`, section 3. Les migrations `20261103…`, `20261105…` et `20261106…` sont **gelées**. Le lot 9 apporte cinq migrations nouvelles, à appliquer dans cet ordre, celui des noms, que suit `db push`.

| Ordre | Migration | Ce qu'elle fait |
|---|---|---|
| 1 | `20261108000001_lot9_securite.sql` | Lecture de `audit_logs` réservée au SUPERADMIN (politique réécrite). Ordre unique des verrous dans `ticket_refund_request`, `event_update` et `ticket_category_guard` (catégorie prise avant le billet, en `FOR NO KEY UPDATE`, événement en `FOR NO KEY UPDATE`), qui supprime leurs interblocages avec `event_cancel` et `checkout_create_payment`. Le trigger anti-boucle de parrainage `trg_check_circular_referral` couvre aussi l'UPDATE de `sponsor_id` et `referred_id`, quel que soit le rôle (A27). Nouvelles fonctions `admin_permissions_set` et `partner_register_finalize` : les écritures qui doivent aller ensemble passent dans une seule transaction (A33). |
| 2 | `20261108000002_lot9_invitations.sql` | Outil d'invitations. La contrainte `tickets_holder_or_counter` admet un billet sans porteur pour le canal `INVITATION` ; `ticket_transfers.from_user_id` devient facultatif. Nouveau type de notification `INVITATION_RECEIVED` (SMS indispensable). Nouvelles fonctions `ticket_invitation_create`, `ticket_invitation_cancel`, `ticket_invitations_list`. Le trigger `trg_events_invitation_expiry` recale l'échéance d'une invitation en attente au report de l'événement. Recopies : `tickets_sale_decision_set` (source `INVITATION`), `ticket_transfer_accept`, `ticket_transfers_incoming` (expéditeur « L'organisateur de l'événement »), `participants_export` (colonne Canal). |
| 3 | `20261108000003_lot9_decouverte.sql` | Colonne `users.city` (ville choisie par le client, facultative). Index `idx_tickets_created_at`, construit sans `CONCURRENTLY` : les écritures de billets attendent la fin de sa construction. Fonction `events_popular` (classement « Populaires » sur 7 jours, invitations exclues). |
| 4 | `20261108000004_lot9_compte.sql` | Objet de code `PHONE_CHANGE` pour les OTP, types `PHONE_CHANGED` (SMS indispensable, vers l'ancien numéro) et `OTP_PHONE_CHANGE`. **Crée le bucket `avatars`** : public, 2 Mo au plus, `image/webp` seul, aucune politique sur `storage.objects`. La route `POST /api/account/avatar` est le seul écrivain (service_role), pour que sharp et le retrait des métadonnées ne puissent pas être contournés. Ne créez pas ce bucket à la main. `REVOKE UPDATE (first_name, last_name, avatar_url)` pour `authenticated` : ces colonnes ne s'écrivent plus que par les routes. Nouvelles fonctions `account_identity_taken`, `account_profile_finalize`, `account_phone_finalize`, `account_avatar_set`, `client_payments_list`. Recopie de `notification_sync_log`. |
| 5 | `20261108000005_lot9_nettoyage.sql` | Retrait du parcours « à régler sur place » (A16) : `ticket_scan` et `ticket_manual_lookup` sans la branche `cash_required`, suppression de `ticket_cash_checkin`. Un billet payant impayé tombe sur le refus `payment_required`, qui existait déjà. L'historique reste lisible : le `CHECK` de `ticket_scans.result` et les filtres du pilotage ne changent pas. |

Aucune ne crée de table, de réglage ni de tâche planifiée, aucune n'ajoute d'aide RLS, aucune ne reprend de données. Toutes sont rejouables, sans `BEGIN` ni `COMMIT` de transaction, et chaque fonction créée ou recréée est `SECURITY DEFINER`, réservée au service_role.

**Contrôles avant d'appliquer :**

1. Depuis le poste de l'opérateur. Remplacez `VOTRE_REFERENCE` par la référence du projet, sans rien ajouter autour : ni chevrons, ni guillemets. Sous PowerShell, `<` et `>` sont des opérateurs, et la commande échouerait.

   ```powershell
   npx supabase@2.122.0 link --project-ref VOTRE_REFERENCE
   npx supabase@2.122.0 migration list --linked
   npx supabase@2.122.0 db push --linked --dry-run
   ```

   `migration list` : `20261106000006` présent des deux côtés, les cinq `20261108…` en local seulement. `--dry-run` : exactement les 5 fichiers `20261108000001` à `…05`, dans cet ordre.

2. **Si la liste contient autre chose** : même règle qu'en 3 bis. S'arrêter, sans `--include-all` et sans `supabase migration repair`.

3. Dans l'éditeur SQL, le contrôle A27, en lecture seule : aucune boucle de parrainage ne doit déjà exister. Attendu : **aucune ligne**.

   ```sql
   with recursive chaine as (
     select r.referred_id as depart, r.sponsor_id as ancetre,
            array[r.referred_id, r.sponsor_id] as chemin, false as boucle
       from public.referral_relationships r
     union all
     select c.depart, r.sponsor_id, c.chemin || r.sponsor_id, r.sponsor_id = any(c.chemin)
       from chaine c
       join public.referral_relationships r on r.referred_id = c.ancetre
      where not c.boucle
   )
   select depart, chemin from chaine where boucle;
   ```

   La remontée du trigger (`check_no_circular_referral`) ne se termine pas sur une boucle déjà présente : la migration passerait, mais toute écriture d'une relation de cette chaîne resterait bloquée jusqu'au délai maximal de la requête. Aucun chemin de code n'a pu en créer. **Une ligne ou plus : s'arrêter**, ne rien corriger à la main et faire examiner ces comptes avant `db push`.

**Appliquer :**

```powershell
npx supabase@2.122.0 db push --linked
```

**Contrôles après, dans l'éditeur SQL, une requête à la fois :**

```sql
-- attendu : 5 lignes, de 20261108000001 à 20261108000005
select version from supabase_migrations.schema_migrations where version like '20261108%' order by version;

-- attendu : 1 ligne, avatars, public = true, 2097152, {image/webp}
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars';

-- attendu : 0 ; aucune politique sur ce bucket
select count(*) as politiques_avatars from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and (coalesce(qual, '') ilike '%avatars%' or coalesce(with_check, '') ilike '%avatars%');

-- attendu : 3 lignes, toutes ESSENTIAL
select type, family from public.notification_types
 where type in ('INVITATION_RECEIVED', 'PHONE_CHANGED', 'OTP_PHONE_CHANGE') order by type;

-- attendu : la définition contient BEFORE INSERT OR UPDATE OF sponsor_id, referred_id
select pg_get_triggerdef(oid) from pg_trigger where tgname = 'trg_check_circular_referral';

-- attendu : NULL ; la fonction est retirée
select to_regprocedure('public.ticket_cash_checkin(jsonb)') as fonction_retiree;

-- attendu : false, false, false
select has_column_privilege('authenticated', 'public.users', 'first_name', 'UPDATE') as prenom,
       has_column_privilege('authenticated', 'public.users', 'last_name', 'UPDATE') as nom,
       has_column_privilege('authenticated', 'public.users', 'avatar_url', 'UPDATE') as photo;
```

Puis exécuter `03-verification.sql` : tout `OK`. La liste blanche des aides RLS reste à 7.

**Déployer l'application du lot 9 juste après, dans la même fenêtre de maintenance, en dehors de tout contrôle d'entrée.** Elle lit la colonne `users.city` et appelle des fonctions qui n'existent qu'après ces migrations (`events_popular`, `ticket_invitation_*`, `account_*`, `client_payments_list`). Inversement, la route `PUT /api/controller/scan` du lot 8 appelle `ticket_cash_checkin`, que la migration 5 retire : sans effet tant qu'aucun billet n'est à régler sur place, mais l'ancienne application ne doit pas rester en service. Retirer `CASH_COLLECT_PER_SCANNER_MIN` de l'hébergeur (5.4) et vérifier que `sharp` est bien installé (5.6).

## 3 quinquies. Projet déjà en service : appliquer seulement les migrations du lot 9 bis

Cas d'un projet où les migrations jusqu'au lot 9 compris (`20261108000001` à `20261108000005`) sont déjà appliquées. Sur un projet neuf, la section 3 suffit : `db push` applique tout. Le projet d'essai event-village-dev suit `docs/essai-local.md`, section 3. Les migrations `20261103…` à `20261108…` sont **gelées**. Le lot 9 bis apporte douze migrations nouvelles, à appliquer dans cet ordre, celui des noms, que suit `db push`.

| Ordre | Migration | Ce qu'elle fait |
|---|---|---|
| 1 | `20261109000001_lot9bis_reglages.sql` | Crée les 3 réglages du lot (4 quater) : `finance.payment_hold_minutes` (10), `finance.min_paid_price` (100), `notif.sms_essential_daily_alert` (2 000). Recrée `fin_setting_valid` et `finance_setting_set` avec ces clés : seul un SUPERADMIN actif les change. |
| 2 | `20261109000002_lot9bis_transfert_statut.sql` | Ajoute seule la valeur `DECLINED` au type `ticket_transfer_status` : un billet reçu peut être refusé par son destinataire. |
| 3 | `20261109000003_lot9bis_registre.sql` | Registre des notifications : 26 types nouveaux (dont `EMAIL_VERIFICATION`, `REFUND_DELAYED`, `ACCOUNT_SUSPENDED`, `SHIFT_OPEN_AT_END`), canal email ajouté aux messages indispensables adressés à un compte, `EVENT_CHANGED` devenu indispensable (les lignes encore en attente sont reclassées). Index de regroupement de la boîte d'envoi. Aucune fonction. |
| 4 | `20261109000004_lot9bis_droits.sql` | Permissions des administrateurs lues dans `admin_permissions` (`admin_can`) : un ADMIN sans `events.write` ne valide, ne suspend ni n'annule plus un événement ; `events.read` pour le pilotage, `refunds.manage` pour rembourser, `partners.read` pour l'export avec contacts. **Aucune permission n'est donnée d'office** (requête « avant » ci-dessous). Seul le SUPERADMIN ajoute ou retire le rôle ADMIN. Table `password_confirmations` (mot de passe saisi depuis moins de 10 minutes pour un transfert ou un changement de numéro), colonnes `partners.ninea`, `partners.rccm`, `partners.resubmitted_at`, journal d'audit des versements par trigger, suspension d'un compte client avec motif (`admin_user_status_set`), complément d'un dossier partenaire refusé. |
| 5 | `20261109000005_lot9bis_samirpay.sql` | Colonnes des frais réels SamirPay sur `payments` et `cashouts` (`samirpay_fees`, `samirpay_net_amount`, `samirpay_ref_operator`, et `cashouts.samirpay_reference`). Frais d'un remboursement d'annulation décidée par le partenaire imputés à son solde (`cashout_fee_apply`). Prix minimum d'une catégorie payante appliqué par trigger. |
| 6 | `20261109000006_lot9bis_argent.sql` | Fonds d'un événement suspendu gelés à la lecture ; suspension d'un partenaire en cascade sur ses événements publiés (table `partner_suspension_cascades`), et retour des seuls événements de la cascade à sa réactivation ; règle unique du retrait et devis avant le code ; droit au remboursement après un report de plus de 24 h (table `event_start_changes`) ; liste des espèces du guichet à rendre par l'organisateur (table `event_cash_refund_marks`) ; remboursement d'un billet par le partenaire jusqu'à la fin de l'événement. |
| 7 | `20261109000007_lot9bis_versements.sql` | « Versements à reprendre » (`cashouts_to_resume`), retard de 30 minutes signalé (`cashouts.delay_flagged_at`), décisions « Renvoyer » et « Marquer versé » (`cashout_admin_decide`, audit dans la même transaction), avis de remboursement retardé. Commissions de parrainage sur un billet disponibles 7 jours après la **fin** de l'événement : reprise des lignes existantes en fin de fichier, annoncée par une ligne `NOTICE`. |
| 8 | `20261109000008_lot9bis_cycle.sql` | Clôture par un admin d'un événement suspendu, **fin par défaut à début + 6 h** pour un événement sans date de fin (`event_end_from_v2`, `event_end_at` ; aucune donnée réécrite), état du contrôle servi au scanner, PIN régisseur exigé à l'ouverture de caisse, transferts (résultat de scan `transfer_pending`, refus par le destinataire, expiration à la lecture), invitations de contrôleurs à accepter (table `controller_invitations`). Deux lignes `NOTICE` en fin de fichier : commissions recalées, et catégories dont la fin de vente dépasse la nouvelle fin. |
| 9 | `20261109000009_lot9bis_messages.sql` | Messages : numéros sans compte prévenus d'une annulation ou d'un changement, changement de date ou de lieu regroupé sur 10 minutes, avis au partenaire, aux admins et aux contrôleurs, scans d'une même commande regroupés, alerte des SMS indispensables du jour. |
| 10 | `20261109000010_lot9bis_email.sql` | L'email devient un vrai canal : colonnes `users.email_verified_at` et `users.email_pending`, table `email_verifications` (lien de 24 h, jeton haché). Un email ne part que vers une adresse **vérifiée** ; l'adresse technique `…@eventvillage.sn` ne reçoit jamais rien. Aucune adresse existante n'est marquée vérifiée. |
| 11 | `20261109000011_lot9bis_textes.sql` | Changement de mot de passe une fois connecté (`account_password_finalize`), quota rendu quand un SMS d'invitation n'est pas parti (`quota_release`). |
| 12 | `20261109000012_lot9bis_mode_reel.sql` | Colonne `users.demo_account` (comptes créés par `seed:dev`, reprise des comptes déjà semés) : rien ne leur est jamais envoyé hors simulation. Fonction en lecture seule `essai_check_reel`, lue par `npm run essai:check-reel`. Sur un projet de production, aucun compte n'est marqué. |

Toutes sont rejouables, sans `BEGIN` ni `COMMIT` de transaction. Chaque fonction créée ou recréée est `SECURITY DEFINER`, réservée au service_role. Les six tables nouvelles ont la sécurité par ligne activée, sans politique : seul le serveur les lit. Aucune aide RLS ni aucune tâche planifiée n'est ajoutée.

**Contrôles avant d'appliquer :**

1. Depuis le poste de l'opérateur, comme en 3 quater :

   ```powershell
   npx supabase@2.122.0 link --project-ref VOTRE_REFERENCE
   npx supabase@2.122.0 migration list --linked
   npx supabase@2.122.0 db push --linked --dry-run
   ```

   `migration list` : `20261108000005` présent des deux côtés, les douze `20261109…` en local seulement. `--dry-run` : exactement les 12 fichiers `20261109000001` à `…12`, dans cet ordre.

2. **Si la liste contient autre chose** : même règle qu'en 3 bis. S'arrêter, sans `--include-all` et sans `supabase migration repair`.

3. Dans l'éditeur SQL, **avant** `db push`, la liste des administrateurs et de leurs permissions. Après la migration 4, un ADMIN n'agit plus que selon ses lignes de `admin_permissions` : un compte dont la liste est vide perd le pilotage, les remboursements, les équipes et la validation des événements. Garder ce résultat ; un SUPERADMIN donne ensuite les permissions manquantes (`/admin/users`, bouton **Permissions**). Le SUPERADMIN n'est pas concerné.

   ```sql
   select u.id, u.email, array_remove(array_agg(p.permission order by p.permission), null) as permissions
     from public.users u
     join public.user_roles r on r.user_id = u.id and r.role = 'ADMIN'
     left join public.admin_permissions p on p.user_id = u.id
    group by u.id, u.email
    order by u.email;
   ```

4. Les comptes qui ont une vraie adresse email. Après la migration 10, ils ne reçoivent plus d'email tant que leur titulaire n'a pas ouvert le lien de vérification (« Renvoyer le lien », dans le profil). Ils gardent la connexion par email.

   ```sql
   select count(*) as adresses_a_verifier from public.users
    where email is not null and email !~* '@([a-z0-9-]+\.)*eventvillage\.sn$';
   ```

5. Les catégories dont la vente finit après la nouvelle fin par défaut (événement sans date de fin : début + 6 h, heure de Dakar). Rien n'est réécrit ; ces ventes s'arrêteront plus tôt. À montrer au client avant d'appliquer.

   ```sql
   select e.title, c.name, c.sale_end
     from public.ticket_categories c
     join public.events e on e.id = c.event_id
    where e.end_date is null and c.sale_end is not null
      and e.status::text not in ('ANNULE', 'TERMINE')
      and c.sale_end > ((e.start_date + coalesce(e.start_time, time '00:00')) at time zone 'Africa/Dakar') + interval '6 hours';
   ```

**Appliquer :**

```powershell
npx supabase@2.122.0 db push --linked
```

Recopier les lignes `NOTICE` qui commencent par `lot 9 bis` : nombre de commissions repoussées à la fin de l'événement, lignes déjà retirées laissées telles quelles, catégories dont la vente dépasse la nouvelle fin.

**Contrôles après, dans l'éditeur SQL, une requête à la fois :**

```sql
-- attendu : 12 lignes, de 20261109000001 à 20261109000012
select version from supabase_migrations.schema_migrations where version like '20261109%' order by version;

-- attendu : 3 lignes, valeurs 100, 10 et 2000
select key, value from public.platform_settings
 where key in ('finance.payment_hold_minutes', 'finance.min_paid_price', 'notif.sms_essential_daily_alert') order by key;

-- attendu : 1 ligne, DECLINED
select enumlabel from pg_enum
 where enumtypid = 'public.ticket_transfer_status'::regtype and enumlabel = 'DECLINED';

-- attendu : 3 lignes, toutes ESSENTIAL
select type, family from public.notification_types
 where type in ('EVENT_CHANGED', 'REFUND_DELAYED', 'EMAIL_VERIFICATION') order by type;

-- attendu : 0 sur un projet de production (aucun compte de démonstration)
select count(*) as comptes_de_demonstration from public.users where demo_account;
```

Puis exécuter `03-verification.sql` : tout `OK`. La liste blanche des aides RLS reste à 7.

**Déployer l'application du lot 9 bis juste après, dans la même fenêtre de maintenance, en dehors de tout contrôle d'entrée.** Elle appelle des fonctions et lit des colonnes qui n'existent qu'après ces migrations : sans la migration 12, chaque SMS, email et push resterait « à réessayer », car le contrôle des comptes de démonstration échoue fermé. Dans le même déploiement : retirer `PAYMENT_HOLD_MINUTES` de l'hébergeur, et ne poser `SAMIRPAY_WEBHOOK_SECRET` qu'en suivant 6.1. Ensuite, donner leurs permissions aux administrateurs relevés au contrôle 3.

## 3 sexies. Projet déjà en service : appliquer seulement les migrations du lot 9 ter

Cas d'un projet où les migrations jusqu'au lot 9 bis compris (`20261109000001` à `20261109000012`) sont déjà appliquées. Sur un projet neuf, la section 3 suffit : `db push` applique tout. Le projet d'essai event-village-dev suit `docs/essai-local.md`, section 3. Les migrations `20261103…` à `20261109…` sont **gelées**. Le lot 9 ter apporte onze migrations nouvelles, à appliquer dans cet ordre, celui des noms, que suit `db push`.

| Ordre | Migration | Ce qu'elle fait |
|---|---|---|
| 1 | `20261110000001_lot9ter_rls.sql` | **Sécurité, indépendante des dix autres.** Plus aucune écriture par l'API REST dans le schéma `public` pour `anon` et `authenticated` : suppression des 25 politiques d'écriture (dont `partners_update_owner`, qui laissait une partenaire écrire son propre `status`), retrait des droits `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE` sur toute relation de `public`, et des privilèges par défaut correspondants. `is_admin()` et `is_superadmin()` exigent désormais un compte `ACTIF`. Les politiques de lecture ne changent pas ; les écritures légitimes passent déjà par les routes serveur et les fonctions. Bloc final qui fait échouer la migration en nommant chaque écriture encore possible (`lot 9 ter (0.1) : écritures REST encore possibles : …`). Aucune donnée modifiée. |
| 2 | `20261110000002_lot9ter_reglages.sql` | Crée les 2 réglages de l'alerte de refus (4 quinquies) : `access.refusal_alert_threshold` (10) et `access.refusal_alert_minutes` (5). Recrée `fin_setting_valid` et `finance_setting_set` avec ces clés. Fonctions `ticket_origin` (origine d'un billet : en ligne, guichet, gratuit, invitation) et `scan_is_refusal` (règle unique d'un refus). |
| 3 | `20261110000003_lot9ter_transfert_statut.sql` | Ajoute seule la valeur `ADMITTED` au type `ticket_transfer_status` : une invitation validée à la porte par la liste des invités avant d'être réclamée est close. |
| 4 | `20261110000004_lot9ter_registre.sql` | Registre des notifications : 4 types nouveaux, `TICKET_REFUNDED_HOLDER` (SMS indispensable au détenteur actuel d'un billet transféré puis remboursé), `ADMIN_EVENT_PUBLISHED` et `ADMIN_EVENT_WITHDRAWN` (cloche et email aux administrateurs qui ont `events.read`), `SCAN_REFUSALS_ALERT` (cloche, push et email à l'organisateur, **aucun SMS**). |
| 5 | `20261110000005_lot9ter_argent.sql` | « Constater non versé » : colonnes `cashouts.not_sent_reference`, `not_sent_reason`, `not_sent_at`, `not_sent_by`, contrainte `cashouts_not_sent_chk`, fonction `cashout_admin_not_sent` (SUPERADMIN, mot de passe saisi depuis moins de 10 minutes ; le versement passe à ÉCHOUÉ, rien ne repart seul). Recopie de `cashout_fee_apply` (frais d'un remboursement passé en créance, risque w19). Commissions de parrainage d'un événement suspendu gelées à la lecture (`fin_frozen_amount`, `fin_withdrawal_check`). |
| 6 | `20261110000006_lot9ter_equipe_messages.sql` | Table `partner_controllers` (un organisateur « connaît » un contrôleur dès sa première affectation), reprise depuis les affectations, caisses, invitations acceptées et scans existants ; un contrôleur jamais affecté par cet organisateur doit accepter une invitation. Avis au détenteur actuel d'un billet transféré remboursé ; cloches aux administrateurs à la publication, au retrait de la validation, à un changement de prix ou de canaux après validation (triggers `trg_event_controllers_partner_link`, `trg_event_status_admin_alert`, `trg_ticket_categories_admin_update_alert`). |
| 7 | `20261110000007_lot9ter_evenements.sql` | Colonne `events.ended_unpublished` ; la tâche de fin termine aussi un événement **validé jamais publié** dont la fin est passée, sans aucun message, invisible du public et jamais scannable ; transition `VALIDE → TERMINE` (17 transitions). Verrous de modification servis à l'écran (`event_edit_locks`). « Retraits en cours » au montant brut (`finance_account_balance`). |
| 8 | `20261110000008_lot9ter_invites.sql` | Colonne `tickets.guest_name` (nom de l'invité, 60 caractères, jamais lisible par l'API REST ni le temps réel) ; méthode de scan `GUEST_LIST` ; recherche du contrôleur dans la liste des invités (`ticket_guest_list_search`, quota par contrôleur et par heure, 5.3 sexies) ; nom modifiable tant que le billet n'est pas utilisé. |
| 9 | `20261110000009_lot9ter_zones.sql` | Tables `event_zones`, `zone_categories`, `event_gates` ; porte d'un contrôleur (`event_controllers.gate_id`, `gate_change_allowed`) ; porte, zone et verdict de zone de chaque scan (`ticket_scans.gate_id`, `zone_id`, `zone_result`) ; couleur et consigne d'entrée d'une catégorie (`scan_color`, `entry_instruction`, jamais lisibles par REST). Recopies de `ticket_scan`, `ticket_manual_lookup`, `counter_sale`, `controller_scan_stats`. Un événement sans zone se comporte comme avant. |
| 10 | `20261110000010_lot9ter_pilotage.sql` | Tableau de bord des entrées par zone, porte, catégorie et origine ; rapport de clôture et export des participants alignés (colonnes Origine, Zone, Porte) ; alerte de refus par le trigger `trg_ticket_scans_refusal_alert` sur les **nouveaux** scans seulement (aucune alerte rétroactive). |
| 11 | `20261110000011_lot9ter_stock.sql` | Colonne `public_event_state.stock_level` (badges « Complet » et « Dernières places » des cartes) et sa contrainte ; recopies des synchronisations publiques et de `ticket_category_create`, `ticket_category_update` (couleur, consigne). Reprise en fin de fichier, événement par événement : chaque événement public émet un signal temps réel au moment de l'application (sans effet visible hors rechargement des cartes ouvertes). |

Toutes sont rejouables, sans `BEGIN` ni `COMMIT` de transaction. Aucune ne lève de `NOTICE` de comptage à recopier ; les avis « … does not exist, skipping » des suppressions conditionnelles sont normaux. Chaque fonction créée ou recréée est `SECURITY DEFINER`, réservée au service_role. Les quatre tables nouvelles (`partner_controllers`, `event_zones`, `zone_categories`, `event_gates`) ont la sécurité par ligne activée, sans politique : seul le serveur les lit. Aucune tâche planifiée n'est ajoutée (section 7 inchangée, 9 tâches).

**Migration 1 seule, en avance (facultatif, sur décision du chef de projet).** Elle ne dépend d'aucune autre et ne casse pas l'application du lot 9 bis, dont le navigateur n'écrit dans aucune table. Pour l'appliquer seule, depuis un dossier de travail placé sur le commit `bcb1d3da` (`fix(9t.1)`), où elle est la seule migration `20261110…` : `git worktree add ..\event-village-m01 bcb1d3da`, puis, dans ce dossier, `git checkout 6796ecf0 -- supabase/migrations/20261110000001_lot9ter_rls.sql` (version finale de la migration 1 : celle de `bcb1d3da` n'a pas encore la réécriture de `users_select_policy` ajoutée par `cf119f51`, sans laquelle le temps réel prend plusieurs secondes de retard ; le fichier doit contenir `users_select_policy`), puis les commandes `link`, `migration list`, `db push --linked --dry-run` (exactement **1** fichier, `20261110000001_lot9ter_rls.sql`) et `db push --linked` ci-dessous ; contrôles « 1 » avant et après ; enfin `git worktree remove ..\event-village-m01`. Les dix autres suivent plus tard, par la procédure complète (le `--dry-run` en liste alors 10). Ne jamais l'appliquer à la main dans l'éditeur SQL, ni utiliser `supabase migration repair`.

**Contrôles avant d'appliquer :**

1. Depuis le poste de l'opérateur, comme en 3 quater :

   ```powershell
   npx supabase@2.122.0 link --project-ref VOTRE_REFERENCE
   npx supabase@2.122.0 migration list --linked
   npx supabase@2.122.0 db push --linked --dry-run
   ```

   `migration list` : `20261109000012` présent des deux côtés, les onze `20261110…` en local seulement (dix si la migration 1 a été appliquée en avance). `--dry-run` : exactement les fichiers `20261110000001` à `…11` restants, dans cet ordre.

2. **Si la liste contient autre chose** : même règle qu'en 3 bis. S'arrêter, sans `--include-all` et sans `supabase migration repair`.

3. Dans l'éditeur SQL, **avant** `db push`, une requête à la fois. Garder chaque résultat : la plupart se comparent après.

   ```sql
   -- 1 (migration 1). Écritures REST encore possibles. Avant : une ligne par politique d'écriture et par droit.
   --   Après : 0 ligne.
   SELECT 'politique' AS genre, tablename AS objet, policyname || ' (' || cmd || ')' AS detail
     FROM pg_policies WHERE schemaname = 'public' AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
   UNION ALL
   SELECT 'droit', c.relname, r.rol || ' : ' || k.priv
     FROM pg_class c CROSS JOIN (VALUES ('anon'), ('authenticated')) r(rol)
     CROSS JOIN (VALUES ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) k(priv)
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND CASE WHEN k.priv IN ('INSERT', 'UPDATE') THEN has_any_column_privilege(r.rol, c.oid, k.priv)
               ELSE has_table_privilege(r.rol, c.oid, k.priv) END
   ORDER BY 1, 2, 3;

   -- 2 (migration 1). Traces d'une fiche partenaire, d'un compte ou d'un paiement modifiés par un jeton
   --   (les fonctions du serveur journalisent user_id NULL). À relire avec le client ; la migration ne réécrit rien.
   SELECT a.created_at, a.user_id, a.user_role, a.action, a.object_id AS partner_id,
          a.old_value->>'status' AS ancien_statut, a.new_value->>'status' AS nouveau_statut,
          a.old_value->>'is_verified' AS ancien_verifie, a.new_value->>'is_verified' AS nouveau_verifie,
          a.old_value->>'subscription_plan_id' AS ancienne_formule, a.new_value->>'subscription_plan_id' AS nouvelle_formule
     FROM public.audit_logs a
    WHERE a.object_type = 'partners' AND a.action IN ('INSERT', 'UPDATE', 'DELETE') AND a.user_id IS NOT NULL
    ORDER BY a.created_at;
   SELECT user_id, count(*) FROM public.partners GROUP BY user_id HAVING count(*) > 1;
   SELECT p.id, p.user_id, p.status FROM public.partners p
    WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role = 'PARTENAIRE');
   SELECT p.id, p.status, u.status AS compte FROM public.partners p JOIN public.users u ON u.id = p.user_id
    WHERE p.status = 'VALIDE' AND u.status <> 'ACTIF';
   SELECT a.created_at, a.user_id, a.object_id FROM public.audit_logs a
    WHERE a.object_type = 'payments' AND a.action = 'UPDATE' AND a.user_id IS NOT NULL
      AND a.old_value->>'status' IS DISTINCT FROM a.new_value->>'status';

   -- 3 (migration 2). Attendu : 0 ligne, puis 0 ligne.
   SELECT key FROM public.platform_settings WHERE key LIKE 'access.refusal_alert_%';
   SELECT proname FROM pg_proc WHERE proname IN ('ticket_origin', 'scan_is_refusal');

   -- 4 (migrations 3, 8, 9). Attendus en commentaire ; les deux derniers comptes sont pour mémoire.
   SELECT enum_range(NULL::public.ticket_transfer_status);                                   -- sans ADMITTED
   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
    WHERE conrelid = 'public.ticket_scans'::regclass AND conname IN ('ticket_scans_method_check', 'ticket_scans_result_check');
   SELECT count(*) FROM public.ticket_scans WHERE method NOT IN ('QR', 'MANUAL', 'COUNTER') OR result IS NULL;   -- 0
   SELECT to_regclass('public.event_zones'), to_regclass('public.zone_categories'), to_regclass('public.event_gates');  -- NULL ×3
   SELECT count(*) FROM pg_constraint WHERE conname = 'ticket_categories_event_id_id_key';  -- 0
   SELECT count(*) AS invitations_en_attente FROM public.tickets
    WHERE sale_channel = 'INVITATION' AND user_id IS NULL AND status = 'VALIDE';
   SELECT count(*) AS points_entree FROM public.event_controllers WHERE entry_point IS NOT NULL;

   -- 5 (migration 4). Attendu : 0 ligne.
   SELECT type FROM public.notification_types
    WHERE type IN ('TICKET_REFUNDED_HOLDER','ADMIN_EVENT_PUBLISHED','ADMIN_EVENT_WITHDRAWN','SCAN_REFUSALS_ALERT');

   -- 6 (migration 5). a) Attendu : 0 ligne (sinon lister et décider ; la migration ne réécrit rien).
   SELECT l.id, l.source_key, l.amount, l.available_at FROM public.finance_ledger l
     LEFT JOIN public.cashouts c ON c.id::text = substr(l.source_key, length('CASHOUT_FEE-') + 1)
    WHERE l.source_key LIKE 'CASHOUT_FEE-%'
      AND (c.id IS NULL OR c.status <> 'CONFIRME' OR c.samirpay_fees IS NULL OR l.amount <> -c.samirpay_fees
           OR NOT EXISTS (SELECT 1 FROM public.finance_ledger r WHERE r.entry_type = 'REMBOURSEMENT' AND r.owner_id = l.owner_id
                           AND r.refund_id = c.refund_id AND r.available_at = l.available_at));
   --    b) Versements incertains sans identifiant SamirPay : candidats au constat « non versé ».
   SELECT kind, count(*), sum(amount) FROM public.cashouts WHERE status = 'INCERTAIN' AND samirpay_transaction_id IS NULL GROUP BY kind;
   --    c) Parrains dont le disponible au retrait baissera (commissions d'un événement suspendu gelées), puis gel
   --       ORGANISATEUR, à comparer après (inchangé).
   SELECT l.owner_id, COALESCE(l.event_id, p.event_id) AS event_id, sum(l.amount) AS net
     FROM public.finance_ledger l LEFT JOIN public.payments p ON p.id = l.payment_id
     JOIN public.events e ON e.id = COALESCE(l.event_id, p.event_id)
    WHERE l.account_kind = 'PARRAINAGE' AND l.available_at <= now() AND e.status::text = 'SUSPENDU'
    GROUP BY 1, 2 HAVING sum(l.amount) > 0;
   SELECT DISTINCT pa.user_id, public.fin_frozen_amount(pa.user_id, 'ORGANISATEUR', now()) AS gel
     FROM public.partners pa JOIN public.events e ON e.partner_id = pa.id WHERE e.status::text = 'SUSPENDU';

   -- 7 (migration 6). Attendu : NULL, puis un nombre à garder.
   SELECT to_regclass('public.partner_controllers');
   SELECT count(*) FROM public.event_controllers;

   -- 8 (migration 7). Événements validés jamais publiés dont la fin est passée : ils passeront à « Terminé », sans
   --   message et invisibles, au premier passage de la tâche ev_events_finish. Puis le montant des retraits en cours,
   --   affiché désormais au brut (frais compris) au lieu du net.
   SELECT id, title, public.event_end_at(id) FROM public.events WHERE status = 'VALIDE' AND public.event_end_at(id) < now();
   SELECT count(*), sum(net_amount), sum(gross_amount) FROM public.withdrawals WHERE status IN ('PENDING','PROCESSING');

   -- 9 (migration 10). Refus déjà enregistrés : aucun ne déclenchera d'alerte. Pour un événement publié connu,
   --   le total des entrées, à comparer après.
   SELECT count(*) FROM public.ticket_scans WHERE NOT accepted;
   SELECT public.pilotage_entries(jsonb_build_object('event_id', '<id de l''événement>', 'actor_id', '<id du compte propriétaire>'))->'total';

   -- 10 (migration 11). N = nombre de résumés publics, puis résumés laissés faux (attendu 0, corrigés par la reprise sinon).
   SELECT count(*) FROM public.public_event_state;
   SELECT count(*) FROM public.public_event_state s WHERE s.has_purchasable AND NOT EXISTS (SELECT 1 FROM public.ticket_categories c WHERE c.event_id = s.event_id AND c.is_active AND c.sale_online AND c.total_quantity - c.sold_quantity - c.held_quantity > 0);
   ```

   Limite du contrôle 2 : le journal des fiches partenaire ne retient que `status`, `subscription_plan_id`, `company_name` et `is_verified`. Une écriture passée de `trial_ends_at`, `is_founder`, `resubmitted_at` ou `phone_verified` est indétectable.

**Appliquer** (les migrations 7 à 11 dans le même `db push`, d'un seul tenant) :

```powershell
npx supabase@2.122.0 db push --linked
```

**Contrôles après, dans l'éditeur SQL, une requête à la fois :**

```sql
-- attendu : 11 lignes, de 20261110000001 à 20261110000011
select version from supabase_migrations.schema_migrations where version like '20261110%' order by version;

-- 1 (migration 1) : la requête 1 d'avant, relancée, rend 0 ligne. Puis : actif = true et proconfig = {search_path=public}
--   pour les deux fonctions, et vrai pour la dernière requête.
SELECT proname, prosrc ~ 'ACTIF' AS actif, proconfig FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace AND proname IN ('is_admin', 'is_superadmin');
SELECT has_function_privilege('anon', 'public.is_admin()', 'EXECUTE');

-- 3 (migration 2) : 2 lignes, {"value": 10} et {"value": 5} ; puis 2 fonctions ; puis vrai.
SELECT key, value FROM public.platform_settings WHERE key LIKE 'access.refusal_alert_%' ORDER BY key;
SELECT proname FROM pg_proc WHERE proname IN ('ticket_origin', 'scan_is_refusal');
SELECT public.fin_setting_valid('access.refusal_alert_threshold', '10'::jsonb);

-- 4 (migrations 3, 8, 9) : attendus en commentaire.
SELECT 'ADMITTED' = ANY (enum_range(NULL::public.ticket_transfer_status)::text[]);        -- vrai
SELECT c.relname, c.relrowsecurity, (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname AND p.schemaname = 'public') AS politiques
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relname IN ('event_zones', 'zone_categories', 'event_gates');   -- true, 0
SELECT has_column_privilege('authenticated', 'public.tickets', 'guest_name', 'SELECT'),
       has_column_privilege('anon', 'public.ticket_categories', 'scan_color', 'SELECT'),
       has_column_privilege('authenticated', 'public.ticket_categories', 'entry_instruction', 'SELECT');   -- faux ×3
SELECT p.proname, count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname IN ('ticket_scan', 'ticket_manual_lookup', 'counter_sale', 'scan_log', 'scan_log_at',
       'scan_gate_context', 'scan_zone_verdict', 'event_zones_get', 'event_zones_save', 'event_controller_gate_set',
       'controller_gate_select', 'ticket_guest_list_search', 'ticket_invitation_guest_name_set') GROUP BY 1;   -- 1 chacune
SELECT count(*) FROM public.ticket_scans WHERE gate_id IS NOT NULL OR zone_id IS NOT NULL OR zone_result IS NOT NULL;  -- 0
SELECT count(*) FROM public.tickets WHERE guest_name IS NOT NULL;                         -- 0
SELECT count(*) FROM public.event_controllers WHERE gate_id IS NOT NULL OR gate_change_allowed;   -- 0
-- et le compte points_entree d'avant : inchangé.

-- 5 (migration 4) : 4 lignes.
SELECT type, family, channels, audience, admin_permission FROM public.notification_types
 WHERE type IN ('TICKET_REFUNDED_HOLDER','ADMIN_EVENT_PUBLISHED','ADMIN_EVENT_WITHDRAWN','SCAN_REFUSALS_ALERT') ORDER BY type;

-- 6 (migration 5) : 4 colonnes, 1 contrainte ; puis vrai, faux (la fonction existe et n'est pas ouverte aux comptes).
SELECT column_name FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'cashouts' AND column_name LIKE 'not\_sent\_%' ORDER BY 1;
SELECT conname FROM pg_constraint WHERE conname = 'cashouts_not_sent_chk';
SELECT to_regprocedure('public.cashout_admin_not_sent(jsonb)') IS NOT NULL,
       has_function_privilege('authenticated', 'public.cashout_admin_not_sent(jsonb)', 'EXECUTE');
--   La dernière requête du contrôle 6 c d'avant rend les mêmes valeurs (gel ORGANISATEUR inchangé) ; pour chaque parrain
--   relevé en 6 c, fin_frozen_amount('<id du parrain>', 'PARRAINAGE', now()) vaut la somme relevée.

-- 7 (migration 6) : table présente avec RLS active ; puis 0 ; puis les 3 triggers.
SELECT relname, relrowsecurity FROM pg_class WHERE oid = to_regclass('public.partner_controllers');
SELECT count(*) FROM public.event_controllers ec JOIN public.events e ON e.id = ec.event_id
 WHERE NOT EXISTS (SELECT 1 FROM public.partner_controllers pc WHERE pc.partner_id = e.partner_id AND pc.user_id = ec.user_id);
SELECT tgname FROM pg_trigger
 WHERE tgname IN ('trg_event_controllers_partner_link', 'trg_event_status_admin_alert', 'trg_ticket_categories_admin_update_alert');

-- 8 (migration 7) : 17 ; puis 0 avant le premier passage de ev_events_finish.
SELECT count(*) FROM public.event_status_transitions;
SELECT count(*) FROM public.events WHERE ended_unpublished;

-- 9 (migration 10) : 1 ligne ; puis, pour l'événement du contrôle 9, une ligne « Entrée » (zone implicite) et un total
--   égal à celui d'avant.
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_ticket_scans_refusal_alert';
SELECT public.pilotage_entries(jsonb_build_object('event_id', '<id de l''événement>', 'actor_id', '<id du compte propriétaire>'))->'by_zone';
SELECT public.pilotage_entries(jsonb_build_object('event_id', '<id de l''événement>', 'actor_id', '<id du compte propriétaire>'))->'total';

-- 10 (migration 11) : colonne et contrainte présentes ; puis 0 ; et le nombre N d'avant, inchangé.
SELECT conname FROM pg_constraint WHERE conname = 'public_event_state_stock_level_check';
SELECT count(*) FROM public.public_event_state s WHERE s.stock_level IS NULL AND EXISTS (SELECT 1 FROM public.ticket_categories c WHERE c.event_id = s.event_id AND c.is_active AND c.sale_online);
SELECT count(*) FROM public.public_event_state;

-- 10 bis (migration 11) : résumés publics justes après la reprise. Attendu : 0 ligne.
WITH thr AS (SELECT public.low_stock_threshold() AS t),
cat AS (
  SELECT tc.id, tc.event_id, tc.price,
         GREATEST(COALESCE(tc.total_quantity, 0) - COALESCE(tc.sold_quantity, 0) - COALESCE(tc.held_quantity, 0), 0) AS r
    FROM public.ticket_categories tc
   WHERE tc.is_active AND tc.sale_online
),
ev AS (
  SELECT s.event_id, s.min_price, s.has_purchasable, s.stock_level, e.status::text AS status,
         (SELECT min(c.price) FILTER (WHERE c.r > 0) FROM cat c WHERE c.event_id = s.event_id) AS want_min,
         (SELECT COALESCE(bool_or(c.r > 0), FALSE) FROM cat c WHERE c.event_id = s.event_id) AS want_any,
         (SELECT CASE WHEN count(*) = 0 THEN NULL
                      WHEN NOT bool_or(c.r > 0) THEN 'SOLD_OUT'
                      WHEN bool_and(c.r <= (SELECT t FROM thr)) FILTER (WHERE c.r > 0) THEN 'LOW'
                      ELSE 'AVAILABLE' END
            FROM cat c WHERE c.event_id = s.event_id) AS want_level
    FROM public.public_event_state s
    JOIN public.events e ON e.id = s.event_id
)
SELECT 'x13'::text AS regle, ev.event_id::text AS objet,
       format('résumé public faux : min_price %s (attendu %s), has_purchasable %s (attendu %s), stock_level %s (attendu %s)',
              ev.min_price, ev.want_min, ev.has_purchasable, (ev.status = 'PUBLIE' AND ev.want_any),
              COALESCE(ev.stock_level, 'NULL'), COALESCE(ev.want_level, 'NULL')) AS detail
  FROM ev
 WHERE ev.min_price IS DISTINCT FROM ev.want_min
    OR ev.has_purchasable IS DISTINCT FROM (ev.status = 'PUBLIE' AND ev.want_any)
    OR ev.stock_level IS DISTINCT FROM ev.want_level
UNION ALL
SELECT 'x13', s.category_id::text,
       format('tranche publique fausse : %s/%s (attendu %s/%s)', s.availability, COALESCE(s.remaining_hint::text, 'NULL'),
              CASE WHEN c.r = 0 THEN 'SOLD_OUT' WHEN c.r <= thr.t THEN 'LOW' ELSE 'AVAILABLE' END,
              CASE WHEN c.r > 0 AND c.r <= thr.t THEN c.r::text ELSE 'NULL' END)
  FROM public.public_category_stock s
  JOIN cat c ON c.id = s.category_id
 CROSS JOIN thr
 WHERE s.availability IS DISTINCT FROM (CASE WHEN c.r = 0 THEN 'SOLD_OUT' WHEN c.r <= thr.t THEN 'LOW' ELSE 'AVAILABLE' END)
    OR s.remaining_hint IS DISTINCT FROM (CASE WHEN c.r > 0 AND c.r <= thr.t THEN c.r END)
UNION ALL
SELECT 'x13', s.category_id::text, 'tranche publique d''une catégorie inactive, hors vente en ligne ou d''un événement non public'
  FROM public.public_category_stock s
  JOIN public.ticket_categories tc ON tc.id = s.category_id
  JOIN public.events e ON e.id = tc.event_id
 WHERE NOT (tc.is_active AND tc.sale_online AND e.status::text IN ('PUBLIE', 'SUSPENDU', 'ANNULE', 'TERMINE'));

-- attendu : 42 (40 depuis le lot 9 bis, 2 de plus)
select count(*) from public.platform_settings;
```

Puis exécuter `03-verification.sql` : tout `OK`. Après la migration 1, `npm run essai:fiche-partenaire` n'a de sens que sur un projet d'essai qui a les comptes de `seed:dev` (`docs/essai-local.md`, section 3) : jamais sur la production.

**Déployer l'application du lot 9 ter juste après les migrations 2 à 11, dans la même fenêtre de maintenance, en dehors de tout contrôle d'entrée.** Elle appelle des fonctions et lit des colonnes qui n'existent qu'après ces migrations (zones, liste des invités, tableau de bord, badges de stock). Dans le même déploiement : la variable facultative `GUEST_LIST_SEARCH_PER_SCANNER_HOUR` (5.3 sexies), rien d'autre à poser ni à retirer. Un événement sans zone se comporte comme avant : aucune partenaire n'a de réglage à faire.

## 4. Données de référence (sans données de test)

- `supabase/seed.sql` n'est **pas** joué par `db push`. Les données de référence nécessaires au fonctionnement sont créées par les migrations :
  - `platform_settings` : **42 clés** depuis le lot 9 ter : 37 depuis le lot 7, les lots 8 et 9 n'en ajoutent aucune, le lot 9 bis en ajoute 3 (4 quater), le lot 9 ter 2 (4 quinquies) (dont `ticketing_fee_config`, migration `0012`, les réglages `finance.*` et `access.*`, les réglages `notif.*` des lots 6 et 7, et les 3 interrupteurs `features.*` du lot 7) ;
  - `referral_config` (4 barèmes) ;
  - `notification_types` : registre des types de notifications (famille, sujet, canaux, destinataires), migration `20261103000002`, complété par les migrations `20261105000002` (deux alertes SMS des administrateurs), `20261105000007` (email de `TRANSFER_RECEIVED`), `20261106000003` (alerte `ADMIN_DUPLICATE_PAYMENT`), `20261108000002` (`INVITATION_RECEIVED`), `20261108000004` (`PHONE_CHANGED`, `OTP_PHONE_CHANGE`), `20261109000003` (26 types du lot 9 bis, canal email des messages indispensables) et `20261110000004` (4 types du lot 9 ter).

  Relevé sur le projet de production le 02/11/2026 après `db push`, **avant** le lot 6 : 24 clés et 4 barèmes, aucune donnée de compte, d'événement, de billet ni de paiement. Après les migrations du lot 6, `select count(*) from platform_settings;` doit donner 33 ; après celles du lot 7, 37 (33 + 5 clés nouvelles − `notif.sms_daily_alert`) ; après celles du lot 9 bis, 40 ; après celles du lot 9 ter, 42.
- `subscription_plans` n'est **pas** rempli par les migrations : ses lignes ne figurent que dans `supabase/seed.sql`, qui ne doit pas être joué en production. La table reste vide tant que le client n'a pas validé les formules et leurs tarifs (point de l'audit) ; elles seront alors créées par une migration dédiée.
- **Ne jamais exécuter** `npm run seed:test` ni `tests/seed/seed-test.ts` contre ce projet : ce seed crée des comptes de test avec un mot de passe connu. Le garde-fou `tests/helpers/env.ts` refuse de toute façon une URL non locale. Même interdiction pour `npm run seed:dev`, réservé au projet d'essai.
- Avant l'ouverture, vérifier et corriger les valeurs métier contradictoires relevées par l'audit (taux de parrainage `referral_config` de la migration `0011` contre CDC §95-§97, tarifs des packs) : traité dans un lot ultérieur, à valider avec le client.

### 4 bis. Réglages des notifications (`notif.*`, lots 6 et 7)

Créés par les migrations `20261103000003` (lot 6) et `20261105000001` (lot 7) avec les valeurs ci-dessous. Comme `finance.*` et `access.*`, ils ne sont modifiables que par un SUPERADMIN actif, par `PUT /api/admin/finance-settings` (page **Réglages** de l'administration, section « Notifications ») : valeur validée en base, motif obligatoire, historique dans `platform_settings_history`.

| Clé | Défaut | Valeurs admises | Rôle |
|---|---|---|---|
| `notif.reminder_j1_enabled` | `true` | booléen | rappel la veille de l'événement |
| `notif.reminder_j1_hour` | `10` | entier de 6 à 20 | heure du rappel de la veille (heure de Dakar) |
| `notif.reminder_h3_enabled` | `true` | booléen | rappel avant le début |
| `notif.reminder_h3_hours` | `3` | entier de 1 à 12 | nombre d'heures avant le début |
| `notif.j1_sms` | `ALWAYS` | `ALWAYS`, `IF_NO_PUSH`, `NEVER` | SMS du rappel de la veille : toujours, seulement sans notification push remise, jamais |
| `notif.h3_sms` | `IF_NO_PUSH` | idem | SMS du rappel avant le début |
| `notif.sms_quiet_start` | `22` | entier de 0 à 23 | début de la plage sans SMS facultatif (heure de Dakar) |
| `notif.sms_quiet_end` | `8` | entier de 0 à 23 | fin de la plage ; début = fin signifie aucune plage |
| `notif.sms_optional_daily_cap` | `700` | entier de 0 à 1 000 000 | **lot 7** : nombre maximal de SMS optionnels envoyés par jour de Dakar (5.5) ; `0` : aucun SMS optionnel. Page : « Plafond quotidien des SMS optionnels » |
| `notif.free_ticket_reminder_sms` | `NEVER` | `NEVER`, `SAME_AS_PAID` | **lot 7** : SMS des rappels (veille et avant le début) pour un porteur qui ne détient, pour cet événement, que des billets gratuits ou des invitations : jamais, ou comme un billet payant. Les rappels partent toujours dans l'application et en push ; la confirmation des billets gratuits garde son SMS. Page : « SMS des rappels pour les billets gratuits » |

`notif.sms_daily_alert` (lot 6, seuil d'alerte sur le nombre de SMS du jour) est **supprimée** par la migration `20261105000001` : elle est remplacée par l'alerte à 80 % du budget des SMS optionnels (5.5). La clé n'est plus acceptée par la page ni par `finance_setting_set`.

Une clé `notif.*` supprimée à la main fait échouer la planification des rappels (tâche `ev_reminders` en erreur 500, visible) ; l'envoyeur continue d'envoyer les messages indispensables et passe les seuls messages facultatifs en « Non envoyée », motif « Réglage des notifications manquant ». C'est aussi le cas de `notif.sms_optional_daily_cap` : sans elle, aucun SMS optionnel ne part, et l'envoyeur journalise « Réglage notif.sms_optional_daily_cap absent : les SMS optionnels ne partent pas. »

### 4 ter. Interrupteurs des services (`features.*`, lot 7)

Créés par la migration `20261105000001`, **tous à `false`** : la plateforme ouvre avec la billetterie seule. Modifiables par un SUPERADMIN actif seulement, page **Réglages**, section « Fonctionnalités » (même mécanisme que 4 bis : valeur validée, motif, historique). Un ADMIN ne peut pas les écrire, ni par la page ni par l'API REST.

| Clé | Défaut | Ce qu'elle ouvre |
|---|---|---|
| `features.halls_enabled` | `false` | salles de fête : réservation par les clients, gestion par les partenaires |
| `features.tables_enabled` | `false` | réservation de tables dans les restaurants |
| `features.orders_enabled` | `false` | menus, produits et commandes de repas |

Fermé, un service n'est ni visible ni utilisable : ses pages et ses routes répondent « page introuvable » (404) et ses entrées disparaissent de la navigation ; `/orders` répond 404 seulement quand les trois sont fermés. Aucun code ni aucune donnée n'est supprimé, et l'achat de billets n'est pas concerné. La page `/admin/services` de l'administration reste lisible. Une valeur absente ou illisible vaut `false` (avertissement dans les journaux du serveur).

### 4 quater. Réglages du lot 9 bis

Créés par la migration `20261109000001`. Modifiables par un SUPERADMIN actif seulement, page **Réglages de la plateforme** (`/admin/finance-settings`), même mécanisme que 4 bis : valeur validée en base, motif, historique.

| Clé | Défaut | Valeurs admises | Libellé de la page, rôle |
|---|---|---|---|
| `finance.payment_hold_minutes` | `10` | entier de 5 à 60 | « Durée de garde des places pendant un paiement (minutes) ». Remplace la variable `PAYMENT_HOLD_MINUTES`, retirée. Un paiement reste valable 1 heure chez SamirPay : validé après la garde, il donne les billets s'il reste des places, sinon il est remboursé automatiquement |
| `finance.min_paid_price` | `100` | entier de 1 à 100 000 | « Prix minimum d'un billet payant (F CFA) ». Appliqué à toute catégorie payante créée ou dont le prix change ; un billet gratuit reste à 0. À ajuster quand SamirPay donnera son minimum d'encaissement |
| `notif.sms_essential_daily_alert` | `2000` | entier de 1 à 1 000 000 | « Seuil d'alerte des SMS indispensables du jour ». Les administrateurs sont alertés une fois par jour au-delà ; ces SMS ne sont jamais plafonnés (5.5) |

Réglages existants dont l'effet change au lot 9 bis : `finance.referral_availability_days` se compte désormais depuis la **fin** de l'événement pour une commission sur un billet ; `finance.withdrawal_fee_rate` est comparé au coût réel constaté des versements, et la page affiche « Frais de retrait sous le coût réel » s'il est plus bas (l'enregistrement n'est pas bloqué).

### 4 quinquies. Réglages du lot 9 ter

Créés par la migration `20261110000002`, valeurs posées seulement si la clé n'existe pas. Modifiables par un SUPERADMIN actif seulement, page **Réglages de la plateforme** (`/admin/finance-settings`), section « Contrôle d’accès », même mécanisme que 4 bis : valeur validée en base, motif, historique. Ils valent pour tous les événements.

| Clé | Défaut | Valeurs admises | Libellé de la page, rôle |
|---|---|---|---|
| `access.refusal_alert_threshold` | `10` | entier de 3 à 500 | « Alerte de refus à une porte : nombre de refus ». Nombre de refus à une même porte, pendant la durée observée, qui déclenche l'alerte `SCAN_REFUSALS_ALERT` à l'organisateur (cloche, push, email ; aucun SMS) |
| `access.refusal_alert_minutes` | `5` | entier de 1 à 60 | « Alerte de refus à une porte : durée observée ». Durée pendant laquelle les refus d'une porte sont comptés ; au plus une alerte par porte et par durée |

Comptent pour l'alerte : billet invalide, déjà utilisé, annulé, remboursé, d'un autre événement, paiement requis, QR expiré, QR dynamique requis, transfert en cours, mauvaise zone, pas encore entré (`scan_alert_refusal`, migration `20261110000010`). Ne comptent pas : les refus liés aux droits du contrôleur, l'encaissement requis, l'état et les horaires de l'événement. Les refus enregistrés avant la migration ne déclenchent rien. Lot 9 ter : aucune autre clé nouvelle ; `access.low_stock_threshold` (existante) sert aussi, désormais, au badge « Dernières places » des cartes.

## 5. Variables d'environnement de l'application

À saisir dans l'hébergeur (jamais dans un fichier versionné). `lib/env.ts` est la référence : il refuse de démarrer les routes serveur si une variable obligatoire manque et liste les absentes. Les exemples de valeurs sont dans `.env.example` ; aucune valeur réelle n'est écrite dans ce document.

### 5.1 Obligatoires (le serveur refuse de démarrer sans elles)

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Projet de production > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem (clé publique) |
| `SUPABASE_SERVICE_ROLE_KEY` | idem (secret serveur) |
| `NEXT_PUBLIC_APP_URL` | URL publique définitive en HTTPS (liens d'activation, URLs de retour de paiement, liens des SMS, emails et notifications push) |
| `SAMIRPAY_API_URL` | `https://app.samirpay.com/samirpays` (jamais l'URL sandbox) |
| `SAMIRPAY_API_KEY`, `SAMIRPAY_SECRET_KEY` | compte SamirPay de **production**, clés nouvelles |
| `MTARGET_USERNAME`, `MTARGET_PASSWORD` | compte MTarget, identifiants renouvelés (le SMS est le canal essentiel) |
| `OTP_HASH_SECRET` | secret aléatoire dédié (`openssl rand -hex 32`), différent de toute autre clé ; le changer invalide seulement les codes OTP en cours (10 min) |
| `TICKET_TOTP_MASTER_KEY` | secret aléatoire dédié (`openssl rand -hex 32`, 32 caractères au moins), différent de toute autre clé : clé maître du code dynamique des billets (QR) ; le changer invalide seulement les QR affichés (rafraîchis toutes les 20 s) |
| `REGISSEUR_PIN_KEY` | secret aléatoire dédié (`openssl rand -hex 32`, 32 caractères au moins), différent de toute autre clé et de `TICKET_TOTP_MASTER_KEY` : clé du hachage des PIN régisseur ; le changer oblige les organisateurs à régénérer leurs PIN |

### 5.2 Obligatoire en exploitation

| Variable | Rôle |
|---|---|
| `CRON_SECRET` | secret aléatoire propre aux tâches planifiées (`openssl rand -hex 32`). Facultatif au démarrage, mais **sans lui toutes les routes `/api/cron/*` répondent 503** (aucun envoi de notification, aucun rappel, aucune réconciliation de paiement). Sa valeur est recopiée dans le secret Vault `ev_cron_secret` (section 7) : les deux doivent rester identiques. |

### 5.3 Facultatives, nouvelles au lot 6

| Variable | Défaut | Rôle |
|---|---|---|
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | aucune | notifications push web (section 6 quater). **Les trois ou aucune** : sans elles (ou avec une configuration partielle ou invalide), le canal push est désactivé, les envois push sont marqués « Non envoyée », motif « Notifications push non configurées », un seul avertissement au démarrage, et tout le reste fonctionne. `VAPID_SUBJECT` : `mailto:<adresse de contact>` ou `https://<domaine>`. `VAPID_PRIVATE_KEY` est un secret, différent de toute autre clé (refusé au démarrage s'il reprend la valeur d'un secret dédié). |
| `MTARGET_TIMEOUT_MS` | 15000 | délai maximal d'un appel MTarget ; au-delà, l'issue du SMS est classée **« Incertaine »** : il n'est jamais renvoyé automatiquement (risque de double SMS facturé) et apparaît comme tel dans la supervision |
| `PUSH_TIMEOUT_MS` | 10000 | délai maximal d'un envoi vers un service push |
| `PUSH_SUBSCRIBE_PER_USER_HOUR` | 20 | inscriptions d'appareils par compte et par heure |
| `PUSH_TEST_PER_USER_HOUR` | 5 | notifications d'essai par compte et par heure (bouton de la page des préférences) |
| `PUSH_ENDPOINT_ALLOWED_ORIGINS` | liste intégrée | **ne pas renseigner en production** : remplace la liste blanche des services push (Google, Mozilla, Apple, Microsoft), qui protège le serveur contre les appels vers des adresses arbitraires ; réservée aux tests |

### 5.3 bis Facultatives, nouvelles au lot 7

Trois quotas en base, de même nature que ceux du lot 4 (chaque appel compte, fenêtres fixes ; au-delà : HTTP 429 avec `Retry-After` ; garde injoignable : HTTP 503). Ce ne sont pas des secrets. Aucune autre variable n'est ajoutée par le lot 7 (relevé de `lib/env.ts` et `.env.example`).

| Variable | Défaut | Rôle |
|---|---|---|
| `OFFLINE_CODES_PER_TICKET_HOUR` | 12 | téléchargements du lot de codes hors ligne d'un même billet par heure (`GET /api/tickets/[id]/offline-codes`). L'application ne retélécharge que si le lot manque, a expiré, a changé de version ou se termine dans moins de 24 h : 12 suffit largement à un usage normal |
| `OFFLINE_CODES_PER_USER_HOUR` | 60 | même quota, par compte et par heure, tous billets confondus |
| `SCAN_LOOKUP_PER_SCANNER_MIN` | 20 | vérifications de saisie manuelle par contrôleur et par minute (`POST /api/controller/scan/lookup`, premier temps de la saisie manuelle, guide `docs/guide-organisateur-entrees.md`) |

### 5.3 ter Lot 8 : aucune variable nouvelle en production

Le lot 8 n'ajoute aucune variable à l'hébergeur. Les variables suivantes servent au seul mode d'essai (`docs/essai-local.md`) et **ne doivent jamais y figurer** : `EV_DEV_FAKE_SERVICES_URL`, `EV_DEV_FAKE_PORT`, `EV_DEV_APP_PORT`, `EV_DEV_PROJECT_REF`, `EV_DEV_SEED_PASSWORD`, `EV_DEV_TUNNEL_URL`, `EV_ESSAI_SIMULATION`. `EV_ESSAI_SIMULATION`, posée par `scripts/dev/essai-start.mjs`, reste sans effet si `SAMIRPAY_API_URL` n'est pas une adresse locale.

### 5.3 quater Facultatives, nouvelles au lot 9

Quatre quotas en base, de même nature que ceux du lot 4 (chaque appel compte, fenêtres fixes ; au-delà : HTTP 429 avec `Retry-After`). Ce ne sont pas des secrets. Aucune variable obligatoire n'est ajoutée et aucun réglage SUPERADMIN nouveau.

| Variable | Défaut | Rôle |
|---|---|---|
| `INVITATION_PER_EVENT_HOUR` | 50 | invitations (une ligne par numéro d'un envoi) par événement et par heure |
| `INVITATION_PER_PHONE_DAY` | 3 | invitations reçues par un même numéro et par jour |
| `PHONE_CHANGE_PER_ACCOUNT_DAY` | 5 | codes de changement de numéro demandés par compte et par jour |
| `AVATAR_UPLOADS_PER_ACCOUNT_HOUR` | 20 | envois de photo de profil par compte et par heure |

### 5.3 quinquies Facultatives, nouvelles ou réactivées au lot 9 bis

Aucune variable obligatoire n'est ajoutée. Les quotas sont de même nature que ceux du lot 4 (chaque appel compte ; au-delà, HTTP 429). Bloc « Lot 9 bis » de `.env.example`.

| Variable | Défaut | Rôle |
|---|---|---|
| `SAMIRPAY_WEBHOOK_SECRET` | aucune | secret de signature des avis de paiement SamirPay (commence par `whsec_`, 16 caractères au moins). **Des deux côtés ou d'aucun** : voir 6.1. Secret : jamais la valeur d'une autre clé |
| `PASSWORD_CONFIRM_PER_ACCOUNT_15MIN` | 5 | saisies du mot de passe avant une action sensible, et changements de mot de passe, par compte et par 15 minutes |
| `PASSWORD_LOGIN_PER_IP_HOUR` | 30 | connexions par mot de passe, par IP et par heure |
| `EMAIL_VERIFY_PER_ACCOUNT_HOUR` | 3 | liens de vérification d'adresse email envoyés par compte et par heure |
| `EMAIL_VERIFY_PER_ADDRESS_DAY` | 5 | liens envoyés à une même adresse, par jour |
| `SUPPORT_EMAIL` | `support@eventvillage.sn` | adresse de support montrée aux personnes. Existait, désormais lue, côté serveur seulement |

**Retirée** : `PAYMENT_HOLD_MINUTES`, remplacée par le réglage `finance.payment_hold_minutes` (4 quater). La retirer de l'hébergeur.

### 5.3 sexies Facultative, nouvelle au lot 9 ter

Une seule variable, facultative, de même nature que les quotas du lot 4 (chaque appel compte, fenêtre fixe d'une heure ; au-delà, HTTP 429 avec `Retry-After`). Ce n'est pas un secret. Aucune variable obligatoire n'est ajoutée, aucune n'est retirée. Ligne `# GUEST_LIST_SEARCH_PER_SCANNER_HOUR=30` de `.env.example`.

| Variable | Défaut | Rôle |
|---|---|---|
| `GUEST_LIST_SEARCH_PER_SCANNER_HOUR` | 30 | recherches dans la « Liste des invités » par contrôleur et par heure (portée de quota `guest_list_search`). Au-delà, le scanner affiche « Trop de recherches dans l’heure : réessayez dans {n} min. » |

### 5.4 Facultatives existantes

| Variable | Défaut | Rôle |
|---|---|---|
| `MTARGET_SENDER`, `MTARGET_SERVICE_ID` | valeurs du compte actuel (`lib/sms/mtarget-http.adapter.ts`) | nom d'expéditeur et service MTarget : à renseigner avec ceux du compte de production |
| `MTARGET_API_URL` | API publique MTarget | à ne changer que sur instruction du fournisseur |
| `SAMIRPAY_TIMEOUT_MS` | 15000 | délai maximal d'un appel SamirPay ; au-delà, un cashout est classé INCERTAIN et n'est jamais renvoyé automatiquement |
| `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL`, `SUPPORT_EMAIL` | aucune | sans `RESEND_API_KEY`, le canal email est désactivé (un avertissement au démarrage, envois email marqués « Non envoyée », motif « Envoi des emails non configuré ») ; SMS, push et notifications in-app partent normalement. Compte Resend du client, à configurer plus tard (clé nouvelle, domaine vérifié) |
| `SUPABASE_AUTH_HOOK_SECRET` | aucune | seulement si le hook SMS de Supabase Auth est activé (6 bis) : sans lui, `/api/auth/sms-hook` refuse tout appel. **Nouveau** secret généré à l'étape 6 bis (jamais la valeur du projet de test, publiée) |
| `SUPERADMIN_PHONE` | aucune | déclarée dans `lib/env.ts` mais lue nulle part : inutile à renseigner ; elle n'attribue aucun rôle (bootstrap : section 8) |
| `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` | OpenStreetMap | fournisseur de tuiles des cartes ; vérifier ses conditions d'usage avant l'ouverture |
| `CLIENT_IP_SOURCE` | `x-forwarded-for` | garder `x-forwarded-for` uniquement derrière un hébergeur qui réécrit l'en-tête ; sinon `x-real-ip` ou `none` (pas de limite par IP) |
| `CHECKOUT_PER_USER_15MIN`, `CHECKOUT_PER_USER_DAY`, `CLAIM_FREE_PER_USER_HOUR`, `PAYMENT_RECONCILE_MIN_AGE_MINUTES`, `PAYMENT_PENDING_MAX_AGE_MINUTES`, `PAYMENT_LATE_SUCCESS_WINDOW_HOURS`, `PAYMENT_RECONCILE_BATCH`, `STATUS_POLL_RECONCILE_SECONDS` | 10, 50, 20, 2, 60, 48, 50, 5 | quotas d'achat par compte, fenêtres et taille de lot de la réconciliation, intervalle minimal des réconciliations demandées par la page de statut (lot 2). La durée de réservation du stock n'est plus une variable depuis le lot 9 bis : réglage `finance.payment_hold_minutes` (4 quater) |
| `SMS_OTP_PER_PHONE_15MIN`, `SMS_OTP_PER_PHONE_DAY`, `SMS_OTP_PER_IP_HOUR`, `SMS_OTP_PER_IP_DAY`, `SMS_PER_PHONE_DAY`, `SMS_GLOBAL_DAILY_CAP` | 3, 10, 10, 30, 30, 1000 | à ajuster au budget SMS du client (5.5) ; `SMS_PER_PHONE_DAY` ne compte que les notifications (l'OTP a ses propres compteurs par numéro) ; `SMS_GLOBAL_DAILY_CAP` est la protection anti-abus de dernier recours : depuis le lot 7, il ne s'applique plus aux SMS indispensables (5.5) ; atteint, il alerte les administrateurs |
| `SMS_OTP_NEW_NUMBER_DAILY_CAP` | 90 | lot 9 quater (A8) : codes vers un numéro SANS compte (inscription, connexion d'un numéro inconnu), par jour ; compteur propre qui ne tire pas sur `SMS_GLOBAL_DAILY_CAP` (des inscriptions en masse ne bloquent plus les codes des comptes existants) ; atteint, il alerte les administrateurs (« Codes d'inscription : part du jour atteinte ») ; total quotidien possible = `SMS_GLOBAL_DAILY_CAP` + cette part |
| `TRANSFER_PER_TICKET_DAY`, `TRANSFER_PER_ACCOUNT_DAY`, `INVITATION_PER_ACCOUNT_DAY` | 3, 10, 50 | lot 9 quater (D1, D2) : transferts de billet offerts par billet et par compte, par jour ; numéros invités sur la liste des invités par compte et par jour (en plus des limites par événement et par numéro) |
| `SMS_GLOBAL_OTP_RESERVED_PERCENT`, `SMS_PER_ACCOUNT_DAY` | 30, 30 | part du plafond global réservée à l'OTP (les autres SMS soumis au plafond s'arrêtent quand le compteur du jour atteint 100 − part %) ; SMS non OTP qu'un même compte connecté peut déclencher par jour |
| `SCAN_PER_SCANNER_10S`, `LIVE_CODE_PER_USER_MIN`, `RESOLVE_PHONE_PER_IP_HOUR`, `VERIFY_OTP_PER_PHONE_15MIN`, `CONTROLLER_SETUP_PER_PHONE_HOUR`, `PARTNER_REGISTER_PER_IP_HOUR`, `INVITE_PER_PARTNER_HOUR`, `INVITE_PER_PHONE_DAY`, `REGISSEUR_PIN_PER_SHIFT_15MIN` | 30, 60, 30, 10, 10, 10, 20, 3, 5 | quotas en base (lot 4) : chaque tentative compte ; au-delà, HTTP 429 ; garde injoignable, HTTP 503 |
| `WITHDRAWAL_REQUEST_PER_USER_HOUR`, `COUNTER_RECEIPT_PER_SHIFT_DAY`, `SCAN_INCIDENT_REPORT_PER_SCANNER_MIN`, `SCAN_INCIDENT_LOG_PER_SCANNER_MIN` | 10, 500, 10, 60 | demandes de retrait par compte et par heure, reçus SMS du guichet par caisse et par jour, incidents de scan déclarés et écrits par minute (lot 5) |
| `DOCUMENT_UPLOADS_PER_IP_HOUR` | 20 | dépôts publics de pièces d'inscription partenaire, par IP et par heure |
| `EV_INTEGRATIONS` | `real` | **ne pas définir**. `fake` n'est accepté qu'en développement (`npm run dev`, mode d'essai) et en test ; ailleurs le serveur le refuse, y compris si `NODE_ENV` est absent. Le refus survient au premier appel d'une route ou d'un adaptateur, pas au démarrage, et `/dev/paiements` n'existe pas dans le build |

Variables qui ne sont plus lues (à retirer si elles existent dans l'hébergeur) : `SAMIRPAY_CASHIN_URL`, `SAMIRPAY_CASHOUT_URL`, `SAMIRPAY_SOLDE_URL`, `SAMIRPAY_STATUS_URL` (lot 2), `CASH_COLLECT_PER_SCANNER_MIN` (lot 9, parcours « à régler sur place » retiré), `PAYMENT_HOLD_MINUTES` (lot 9 bis). `SAMIRPAY_WEBHOOK_SECRET`, retirée au lot 2, est **de nouveau lue** depuis le lot 9 bis (5.3 quinquies et 6.1) : ne la laisser que si SamirPay signe ses avis avec ce même secret.

Règles :

- aucune clé du projet de test ou de l'ancien `.env.local` n'est réutilisée ;
- `SUPABASE_AUTH_HOOK_SECRET` ne sert plus qu'au hook SMS (lot 4 : QR dynamiques et PIN régisseur ont leurs clés dédiées `TICKET_TOTP_MASTER_KEY` et `REGISSEUR_PIN_KEY`) ; il doit être unique à la production ;
- `OTP_HASH_SECRET`, `TICKET_TOTP_MASTER_KEY` et `REGISSEUR_PIN_KEY` sont trois secrets différents : le serveur refuse de démarrer si l'un d'eux reprend la valeur d'un autre ou d'une autre clé (service_role, hook, cron, SamirPay, clé privée VAPID).

### 5.5 Deux plafonds SMS différents : `notif.sms_optional_daily_cap` et `SMS_GLOBAL_DAILY_CAP`

Depuis le lot 7, deux mécanismes distincts limitent les SMS. Ils n'ont ni le même but, ni le même périmètre, ni le même réglage.

| | `notif.sms_optional_daily_cap` | `SMS_GLOBAL_DAILY_CAP` |
|---|---|---|
| Nature | **budget** : ce que le client accepte de payer chaque jour en SMS facultatifs | **protection anti-abus de dernier recours** : borne dure contre un emballement (boucle, attaque sur les codes) |
| Où le régler | réglage SUPERADMIN (`platform_settings`), page Réglages, section « Notifications » : effet immédiat, sans redéploiement, motif et historique | variable d'environnement de l'hébergeur : redéploiement |
| Défaut | 700 par jour de Dakar | 1 000 par jour (minuit UTC, qui est minuit à Dakar), dont `SMS_GLOBAL_OTP_RESERVED_PERCENT` = 30 % réservés aux codes |
| SMS concernés | les SMS **optionnels** de la boîte d'envoi seulement (famille `OPTIONAL` du registre) : rappel de la veille, rappel avant le début, rappel des contrôleurs, changement de date ou de lieu, premier billet vendu, catégorie épuisée, événement complet | les codes OTP, jusqu'au plafond entier ; les SMS optionnels, les invitations de contrôleurs et les envois directs sans famille, jusqu'à la part non OTP (70 %, soit 700 par défaut) |
| SMS jamais concernés | les SMS indispensables (famille `ESSENTIAL` : confirmation d'achat et de billets gratuits, reçus du guichet, remboursement versé, annulation d'un événement, transferts, changement de mot de passe, statut des événements et des partenaires, début d'essai, affectation et activation des contrôleurs, écart de caisse, retraits, invitations à un événement et changement de numéro du lot 9), les codes OTP, les invitations de contrôleurs | les SMS indispensables de la boîte d'envoi : **plus aucun plafond journalier global** ne les refuse |
| Comment c'est compté | lignes SMS optionnelles réservées par l'envoyeur (en cours d'envoi, envoyées ou à l'issue incertaine) dans le jour de Dakar ; une tentative réservée compte même si l'envoi échoue ensuite | un compteur unique du jour, **partagé** par les codes OTP, les SMS optionnels, les invitations et les envois sans famille ; les SMS indispensables n'y entrent pas |
| Au-delà | le SMS n'est pas envoyé : « Non envoyée », motif « Plafond journalier des SMS optionnels atteint », sans relance ; l'in-app et le push partent normalement | notification : « Non envoyée », motif « Plafond quotidien de SMS atteint » ; code OTP : demande refusée (HTTP 429) |
| Alertes | à 80 % du budget : notification dans l'application et email (si le canal email est configuré) aux administrateurs ayant la permission `notifications.read`, et signal `SMS_OPTIONAL_80`, une fois par jour ; la veille : si les rappels SMS prévus pour le lendemain dépassent le budget restant de ce jour-là, notification aux mêmes administrateurs (nombre prévu, budget restant, plafond) et signal `SMS_FORECAST`, une fois par jour ; budget à 0 : aucune alerte | une fois par jour et par type (plafond entier, part non OTP), dans l'application, aux administrateurs `notifications.read` ; jamais par SMS |
| Suivi | page **Notifications** de l'administration : carte « SMS optionnels aujourd'hui » (envoyés, plafond, seuil de 80 %) | même page, alertes |

Les quotas anti-abus du lot 1C restent appliqués aux SMS indispensables comme aux autres : par destinataire (`SMS_PER_PHONE_DAY`) pour tout SMS hors OTP, par compte déclencheur (`SMS_PER_ACCOUNT_DAY`) quand un compte connecté provoque l'envoi, par caisse (`COUNTER_RECEIPT_PER_SHIFT_DAY`) pour les reçus du guichet ; les codes OTP gardent leurs propres compteurs par numéro et par IP, et leur réserve sur `SMS_GLOBAL_DAILY_CAP`.

**SMS du lot 9.** `INVITATION_RECEIVED` et `PHONE_CHANGED` sont des SMS indispensables de la boîte d'envoi : ils ne comptent ni dans le budget optionnel, ni dans `SMS_GLOBAL_DAILY_CAP`. Ils restent limités par `SMS_PER_PHONE_DAY`, et par leurs propres quotas (5.3 quater) ; sans compte déclencheur, ils ne comptent pas dans `SMS_PER_ACCOUNT_DAY`. Ne pas les confondre avec les invitations de contrôleurs, qui comptent dans la part non OTP. `OTP_PHONE_CHANGE` est un code OTP comme les autres : il compte dans le plafond entier et dans les codes prévus de la règle ci-dessous.

**Ordre des contrôles.** Le budget optionnel est vérifié en premier, au moment où l'envoyeur réserve la ligne (sous verrou, deux envoyeurs simultanés ne le dépassent pas) ; la garde anti-abus ne voit ensuite que les SMS admis par le budget. Le 701ᵉ rappel du jour est donc refusé avec le motif « Plafond journalier des SMS optionnels atteint », et une confirmation d'achat envoyée juste après part normalement.

**Recouvrement avec les valeurs par défaut.** La part non OTP de la garde (700) est égale au budget optionnel (700), mais elle est comptée sur le compteur partagé : les codes OTP et les invitations de contrôleurs envoyés le même jour la consomment aussi. Un jour avec 150 codes de connexion et 20 invitations envoyés avant les rappels, les SMS optionnels seraient arrêtés par la garde au 531ᵉ (motif « Plafond quotidien de SMS atteint »), avant d'atteindre leur budget. Pour que le budget optionnel soit la vraie limite :

`SMS_GLOBAL_DAILY_CAP` × (100 − `SMS_GLOBAL_OTP_RESERVED_PERCENT`) / 100 ≥ budget optionnel + invitations prévues + codes OTP prévus le même jour.

Exemple : budget 700, 50 invitations et 300 codes un jour de grand événement, réserve de 30 % : `SMS_GLOBAL_DAILY_CAP` ≥ (700 + 50 + 300) / 0,7 = 1 500. Relever le budget optionnel sans relever `SMS_GLOBAL_DAILY_CAP` ne sert à rien au-delà de cette limite.

**Coût par billet, réglages par défaut.** 1 SMS de confirmation par **commande** (au numéro du payeur), 1 SMS de rappel la veille par compte porteur et par événement, et 1 SMS de rappel avant le début seulement si aucune notification push n'a été remise (aucun si ce rappel tombe dans la plage sans SMS, de 22 h à 8 h). Une commande d'un billet sans push coûte donc **3 SMS**, avec push **2** ; une commande de 4 billets gardés par l'acheteur, sans push, 0,75 SMS par billet. Un porteur qui n'a que des billets gratuits ou des invitations pour l'événement ne reçoit que la confirmation (**1 SMS**) tant que `notif.free_ticket_reminder_sms` vaut `NEVER`. Au-delà de 700 SMS optionnels le même jour, les rappels suivants partent sans SMS. Un billet transféré ajoute 1 SMS (au destinataire). S'y ajoutent les messages occasionnels (annulation, remboursement versé, changement de date ou de lieu, premier billet vendu, catégorie épuisée, événement complet, écart de caisse, retrait) et les codes OTP.

Avant l'ouverture des ventes, fixer avec le client, d'après son budget MTarget : le budget optionnel quotidien, puis `SMS_GLOBAL_DAILY_CAP` selon la règle ci-dessus.

**SMS indispensables, lot 9 bis.** Ils restent sans plafond journalier, mais le lot en ajoute plusieurs (remboursement retardé, compte suspendu ou réactivé, changement de date ou de lieu devenu indispensable et prévenu aussi aux numéros sans compte, annulation aux invitations non réclamées et aux acheteurs au guichet, contrôleurs). Le réglage `notif.sms_essential_daily_alert` (4 quater, 2 000 par défaut) alerte les administrateurs une fois par jour quand leur nombre du jour le dépasse. Le fixer avec le client, au-dessus du volume d'une journée normale.

### 5.6 Exigences de l'hébergeur ajoutées par le lot 7

- **HTTPS obligatoire** (déjà exigé par `NEXT_PUBLIC_APP_URL`) : les navigateurs n'enregistrent un service worker et n'ouvrent la caméra que sur une origine sécurisée. Sans HTTPS, ni billet hors ligne, ni scanner.
- **Service worker** : `public/sw.js`, servi à la racine (`/sw.js`, portée `/`). Il ne met en cache que la page `/billet/hors-ligne`, ses fichiers statiques et les icônes, jamais une réponse de `/api/` (cache `ev-hors-ligne-lot7-1` ; les anciens caches `event-village-*` sont supprimés à l'activation). C'est un changement par rapport au lot 6, où le service worker ne mettait rien en cache.
- **Compression des réponses** : le lot de codes hors ligne d'un billet (48 h au plus) reste sous 40 Ko une fois compressé en gzip (contrôlé par `tests/parcours/hors-ligne-codes.test.ts`). `next start` ne compresse aucune route API, malgré `compress: true` (constat du lot 8) : depuis `fix(8.2x)`, `GET /api/tickets/[id]/offline-codes` sert elle-même du gzip quand le navigateur l'accepte. Derrière un proxy ou un CDN, vérifier que ce corps et son en-tête `Content-Encoding` sont transmis tels quels, au choix de l'hébergeur.
- **Images** : `sharp` 0.33.5 est une dépendance figée de l'application (optimisation des images par Next.js) et, **depuis le lot 9, elle est requise en production** : `POST /api/account/avatar` l'importe directement pour redimensionner les photos de profil et retirer leurs métadonnées. Sans son binaire pour la plate-forme de l'hébergeur, cette route (envoi et suppression de la photo) répond 500, le reste de l'application continue. Après le déploiement, envoyer une photo depuis la page profil. `package-lock.json` contient ses binaires Linux x64 (glibc et musl) et arm64 : ne jamais recopier le `node_modules` d'un poste Windows. Installer par `npm ci` sur la plate-forme de l'hébergeur, jamais par `npm install`. Depuis `fix(8.2w)`, le dépôt n'a plus de `.npmrc` ni de `legacy-peer-deps` : `package-lock.json` est régénéré avec npm 10, et `npm install` sous npm 11 lui retirerait des entrées que npm 10 exige.
- **Paquets de test en production** : `npm ci --omit=dev` garde désormais `@playwright/test`, `playwright` et `playwright-core` (environ 19 Mo). `next` déclare `@playwright/test` en dépendance optionnelle, et le lock les marque `devOptional`. L'application ne les charge pas.

## 6. Paiements SamirPay (lot 2)

- Contrat appliqué : cashin direct (`/api/tiers/direct/initPayment`), statut (`/api/tiers/payments/{id}/status`), cashout (`/api/tiers/payments/send`), solde, sous `SAMIRPAY_API_URL`. Les anciennes variables `SAMIRPAY_CASHIN_URL`, `_CASHOUT_URL`, `_SOLDE_URL` et `_STATUS_URL` ne sont plus lues : les retirer. `SAMIRPAY_WEBHOOK_SECRET` est de nouveau lue depuis le lot 9 bis (6.1).
- Le webhook est adressé par SamirPay au `callBackUrl` transmis à chaque paiement (`https://<domaine>/api/webhooks/samirpay?t=<jeton du paiement>`). `NEXT_PUBLIC_APP_URL` doit être l'URL publique HTTPS définitive.
- Le solde du compte partenaire SamirPay doit couvrir les remboursements : il est vérifié avant chaque envoi. Depuis le lot 9 bis, un versement bloqué (solde insuffisant, limites du compte) ou en retard de plus de 30 minutes apparaît dans « Versements à reprendre », sur `/admin/finance`, et une alerte part aux administrateurs. Seul un administrateur qui a la permission `refunds.manage` peut alors « Renvoyer » ou « Marquer versé », avec une justification.

### 6.1 Signature des avis de paiement (lot 9 bis)

La version 1.2 de l'API SamirPay peut signer chaque avis de paiement (en-tête `X-SamirPay-Signature`). L'application la vérifie seulement si `SAMIRPAY_WEBHOOK_SECRET` est défini : HMAC-SHA256 de l'horodatage et du corps reçu, 5 minutes d'écart au plus, plusieurs signatures admises pendant un changement de secret (`lib/samirpay/webhook-signature.ts`). Avec ou sans signature, aucun billet n'est émis sans la confirmation par l'endpoint de statut.

**Le secret doit être posé des deux côtés, ou d'aucun.**

| SamirPay signe | `SAMIRPAY_WEBHOOK_SECRET` dans l'hébergeur | Résultat |
|---|---|---|
| non | absent | Comportement des lots précédents : jeton propre à chaque paiement dans l'adresse de l'avis, puis confirmation par le statut |
| oui | le même secret | Signature vérifiée en plus |
| non, ou avec un autre secret | présent | **Chaque avis est refusé (401)**, journalisé `REJECTED_SIGNATURE`. Les paiements ne sont confirmés que par la réconciliation, toutes les 5 minutes : les clients attendent leurs billets |
| oui | absent | Signature ignorée, comportement des lots précédents |

**Ordre d'activation :** activer la signature dans le compte SamirPay, copier le secret qu'il donne (`whsec_…`), le saisir dans l'hébergeur, redéployer. Pour l'arrêter : retirer d'abord la variable de l'hébergeur et redéployer, puis désactiver la signature chez SamirPay. La clé exacte du calcul (secret entier, préfixe `whsec_` compris) est **à confirmer en bac à sable** avant de poser le secret en production.

**Contrôle**, dans l'éditeur SQL, après quelques paiements. Attendu : aucune ligne `REJECTED_SIGNATURE`.

```sql
select result, count(*) from public.payment_webhook_events
 where first_received_at > now() - interval '1 day'
 group by result order by result;
```

### 6.2 Retour du client après le paiement (lot 9 ter)

Quand `NEXT_PUBLIC_APP_URL` commence par `https://`, chaque initialisation de paiement envoie aussi à SamirPay `successUrl` et `errorUrl`, toutes deux égales à `{NEXT_PUBLIC_APP_URL}/paiement/{id du paiement}` (`lib/payments/cashin-init.ts:56-60`) : Wave et Orange Money ramènent le client sur la page de suivi de son paiement, en cas de succès comme d'échec. Cette page lit l'issue sur le serveur ; elle n'en déduit jamais rien de l'adresse de retour. En `http` (essai local, CI), rien n'est envoyé. Aucune variable nouvelle. **À vérifier en bac à sable SamirPay** avant toute séance réelle : que l'API accepte ces deux champs.

## 6 ter. Finance (lot 3)

- **Réglages financiers** : clés `finance.*` de `platform_settings`, créées par la migration `20261101000002_lot3_reglages.sql` avec les valeurs par défaut ci-dessous. Elles ne sont modifiables que par un SUPERADMIN, par `PUT /api/admin/finance-settings` (valeur validée en base, motif obligatoire, historique dans `platform_settings_history`). Une modification ne s'applique qu'aux opérations suivantes : les taux sont recopiés sur chaque paiement, commission et retrait au moment où ils naissent.

  | Clé | Défaut | Rôle |
  |---|---|---|
  | `finance.service_fee_rate` | 5 | frais de service payés par l'acheteur (% du prix, au FCFA supérieur par billet) |
  | `finance.aggregator_fee_rate.WAVE` / `.ORANGE_MONEY` | 1,5 / 1,5 | frais SamirPay sur le total payé, par opérateur |
  | `finance.cancellation_aggregator_fee_bearer` | EVENT_VILLAGE | qui supporte les frais d'agrégateur perdus quand l'organisateur rembourse ou annule |
  | `finance.payout_hold_enabled` / `finance.payout_delay_hours` | true / 48 | fonds organisateur disponibles à la fin de l'événement + délai |
  | `finance.withdrawal_fee_rate` / `finance.withdrawal_min_amount` | 1 / 5 000 | frais (FCFA supérieur) et seuil de retrait |
  | `finance.withdrawal_bank_enabled` | false | retraits par virement bancaire |
  | `finance.referral_availability_days` | 7 (7 à 14) | délai avant qu'une commission de parrainage soit disponible ; pour une commission sur un billet, compté depuis la fin de l'événement (lot 9 bis) |
  | `finance.payment_hold_minutes`, `finance.min_paid_price` | 10, 100 | lot 9 bis : durée de garde des places pendant un paiement, prix minimum d'un billet payant (4 quater) |

- **Retraits** : par Wave ou Orange Money uniquement (le virement reste fermé tant que le réglage est faux), confirmés par un code SMS envoyé au téléphone du compte, versés par le module de cashout. Le solde SamirPay doit couvrir aussi les retraits. Un envoi à l'issue incertaine n'est jamais relancé automatiquement : il reste réservé et apparaît dans « Versements à reprendre » (6), où un administrateur `refunds.manage` le « Renvoie » seulement si SamirPay confirme que rien n'est parti, ou le « Marque versé » avec la référence SamirPay. Depuis le lot 9 bis, le retrait est aussi bloqué 24 heures après un changement de numéro du compte, et l'écran montre le minimum, les frais et le montant net avant d'envoyer le code.
- **Grand livre** : les soldes organisateur et parrainage sont calculés depuis `finance_ledger` ; un projet neuf démarre vide (aucune reprise d'historique n'est prévue).

## 6 bis. Hook SMS de Supabase Auth

À configurer seulement si le fournisseur téléphone de Supabase Auth est activé (il ne l'est pas, section 2).

1. **Authentication > Hooks > Send SMS hook** : type HTTPS, URL `https://<domaine>/api/auth/sms-hook`.
2. Générer le secret dans ce même écran, le reporter dans `SUPABASE_AUTH_HOOK_SECRET` de l'application, redéployer.
3. Tester l'envoi d'un OTP vers un numéro de l'équipe.

Le hook n'accepte que la signature Standard Webhooks de Supabase (horodatage à ± 5 minutes) ou le secret complet ; chaque envoi passe par les limites anti-abus des OTP et le plafond global.

## 6 quater. Notifications push web (lot 6, facultatif)

Sans clés VAPID, l'application fonctionne entièrement ; la page « Préférences de notification » indique alors que les notifications push sont indisponibles pour le moment.

1. Sur le poste de confiance de l'opérateur, dans le dépôt (la bibliothèque `web-push` est une dépendance figée) :

   ```bash
   npx web-push generate-vapid-keys --json
   ```

   La commande affiche une clé publique et une clé privée. Ne pas les copier ailleurs que dans l'hébergeur et le gestionnaire de secrets.
2. Saisir dans l'hébergeur `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et `VAPID_SUBJECT` (`mailto:<adresse de contact du client>`), puis redéployer.
3. Vérifier : un compte de l'équipe active les notifications sur la page des préférences (le navigateur ne demande l'autorisation qu'après ce clic), puis utilise le bouton d'essai : la notification arrive dans la minute (passage de l'envoyeur, tâche `ev_notifications_dispatch`).

Limites : sur iPhone, le push web ne fonctionne que pour l'application installée sur l'écran d'accueil. **Rotation des clés** : changer la paire VAPID invalide tous les abonnements existants ; ils sont supprimés au premier envoi suivant, et chaque appareil se réabonne à la prochaine ouverture de l'application si l'autorisation a été accordée. Entre-temps, ces appareils ne reçoivent plus de push (les SMS de rappel en mode « seulement sans push » partent alors). À ne faire qu'en cas de fuite de la clé privée.

## 7. Tâches planifiées

L'hébergeur n'est pas choisi : la planification est portée par la base, avec **pg_cron** (planificateur) et **pg_net** (appels HTTP), et ne dépend pas de l'hébergeur. Chaque tâche appelle une route `/api/cron/*` de l'application en POST avec l'en-tête `Authorization` construit depuis Vault ; les routes sont publiques au middleware et se protègent elles-mêmes (`CRON_SECRET`, comparaison à temps constant ; 503 sans `CRON_SECRET`, 401 sans le bon jeton). L'URL de l'application et le secret sont lus dans **Supabase Vault à chaque exécution** : aucun d'eux n'est écrit dans la définition des tâches (`cron.job`).

### 7.1 Les 9 tâches

| Tâche | Route | Expression (UTC) | Fréquence | Raison |
|---|---|---|---|---|
| `ev_notifications_dispatch` | `/api/cron/notifications-dispatch` | `* * * * *` | chaque minute | envoyeur unique de la boîte d'envoi (in-app, SMS, email, push) : la première relance est prévue à 1 min, les envois interrompus sont repris après 10 min, la confirmation d'achat et la cloche n'attendent pas 5 min ; un passage sans ligne due coûte une lecture indexée. Délai pg_net de 55 s (l'envoyeur travaille 45 s au plus) |
| `ev_reminders` | `/api/cron/reminders` | `1-59/5 * * * *` | toutes les 5 minutes, à 1, 6, 11… | crée les rappels dus (veille, avant le début, rappel des contrôleurs) ; chaque rappel est créé dans les 15 min de tolérance qui suivent son échéance (5 min suffisent, sans rattrapage). Décalé d'une minute pour ne pas tomber avec la réconciliation |
| `ev_payments_reconcile` | `/api/cron/payments-reconcile` | `*/5 * * * *` | toutes les 5 minutes (**obligatoire**) | statut SamirPay des paiements en attente : confirmation (billets), échec ou annulation (stock rendu), expiration des paiements trop anciens, succès tardifs, confirmation et contrôle des remboursements ; le webhook SamirPay n'étant envoyé qu'en cas de succès, c'est le seul moyen de connaître FAILED et CANCELLED |
| `ev_events_finish` | `/api/cron/events-finish` | `3-59/15 * * * *` | toutes les 15 minutes, à 3, 18, 33, 48 (**obligatoire**) | passage à TERMINÉ des événements publiés dont la fin est passée (fin renseignée ; date de fin sans heure : 23:59 ; depuis le lot 9 bis, sans date de fin : début + 6 h ; heure de Dakar), journalisé par le système ; depuis le lot 9 ter, aussi des événements validés jamais publiés, sans aucun message ; le scan et l'ouverture de caisse restent possibles jusqu'à la fermeture de la fenêtre de scan (`access.scan_window_after_hours`) |
| `ev_stock_reservations` | `/api/cron/stock-reservations` | `7 * * * *` | horaire, à la minute 7 | purge des réservations de stock échues ; la réconciliation, toutes les 5 minutes, la fait aussi en début de passage, d'où l'heure suffisante |
| `ev_ticket_transfers` | `/api/cron/ticket-transfers` | `17 * * * *` | horaire, à la minute 17 | expiration des transferts de billets non acceptés sous 48 h (l'expéditeur est prévenu) |
| `ev_moratoriums` | `/api/cron/moratoriums` | `27 * * * *` | horaire, à la minute 27 | moratoires des réservations de salle |
| `ev_referral_commissions` | `/api/cron/referral-commissions` | `37 * * * *` | horaire, à la minute 37 | commissions de parrainage arrivées à échéance : EN ATTENTE → DISPONIBLE (le solde les rend déjà disponibles à leur date ; la tâche met le statut affiché à jour) |
| `ev_cron_history_purge` | aucune (SQL) | `30 3 * * *` | chaque nuit à 03:30 | purge de `cron.job_run_details` au-delà de 7 jours (la table grossit d'environ 1 900 lignes par jour) |

Les tâches horaires sont décalées (7, 17, 27, 37) pour éviter quatre appels simultanés. Pg_cron compte en UTC, qui est aussi l'heure de Dakar.

Changement du lot 6 : l'ancienne tâche `ev_event_change_notifications` du lot 5 n'existe plus (sa route est supprimée, les avis de changement de date ou de lieu passent par la boîte d'envoi) ; le script de planification la retire s'il la trouve.

### 7.2 Procédure sur Supabase hébergé

Les scripts sont `supabase/ops/schedule-crons.sql` (planification) et `supabase/ops/unschedule-crons.sql` (arrêt). Ce ne sont **pas** des migrations : `db push` ne les joue pas. Les deux sont transactionnels (tout ou rien) et peuvent être relancés sans effet de bord.

1. **Pré-requis** : migrations appliquées (section 3), application déployée et joignable en HTTPS, `CRON_SECRET` saisi dans l'hébergeur (5.2), redéploiement fait. Contrôle depuis le poste de l'opérateur : un appel sans en-tête à `https://<domaine>/api/cron/notifications-dispatch` doit répondre 401 (et non 503, qui signale un `CRON_SECRET` absent).
2. **Extensions** : dans **Database > Extensions**, activer `pg_cron` et `pg_net` (le script les active aussi s'il en a le droit). Vault (`supabase_vault`) est actif par défaut sur Supabase.
3. **Secrets Vault**, une seule fois, dans l'éditeur SQL (ou dans l'écran Vault du tableau de bord), en remplaçant les deux valeurs entre chevrons :

   ```sql
   select vault.create_secret('https://<domaine>', 'ev_app_url');
   select vault.create_secret('<valeur de CRON_SECRET>', 'ev_cron_secret');
   ```

   - `ev_app_url` : origine seule, en HTTPS, sans chemin (le script refuse une autre forme ; HTTP n'est admis que pour un hôte local) ; en général la même valeur que `NEXT_PUBLIC_APP_URL` ;
   - `ev_cron_secret` : exactement la valeur de `CRON_SECRET` de l'hébergeur ;
   - ne pas enregistrer cette requête comme extrait (« snippet ») de l'éditeur ; fermer l'onglet ensuite. La valeur ne doit apparaître dans aucune capture ni aucun message.
4. **Planification** : ouvrir `supabase/ops/schedule-crons.sql`, coller son contenu entier dans l'éditeur SQL, exécuter. Sans les secrets, il s'arrête avec un message explicite (par exemple « Secret Vault ev_app_url absent ») et ne change rien. Le dernier résultat affiché liste les 9 tâches, toutes actives.
5. **Vérifications** :

   ```sql
   -- 9 lignes ev_..., active = true ; aucune autre tâche ev_
   select jobname, schedule, active from cron.job order by jobname;

   -- exécutions récentes : status = succeeded signifie que la requête HTTP a été mise en file
   select j.jobname, d.status, d.return_message, d.start_time
     from cron.job_run_details d join cron.job j on j.jobid = d.jobid
    order by d.start_time desc limit 20;

   -- réponses HTTP de l'application (gardées quelques heures par pg_net)
   select id, status_code, error_msg, created from net._http_response order by created desc limit 20;
   ```

   Attendu : des réponses 200. Un 401 signifie que `ev_cron_secret` diffère de `CRON_SECRET` ; un 503, que `CRON_SECRET` manque dans l'hébergeur ; une erreur de délai ou de résolution, que `ev_app_url` est faux ou que l'application ne répond pas. Côté application, la page **Notifications** de l'administration montre les envois passés par la boîte d'envoi.
6. **Tâches manuelles plus anciennes** : si des tâches avaient été créées à la main (sans le préfixe `ev_`, par exemple à partir d'une ancienne version de ce document), les retirer : `select cron.unschedule('<nom de la tâche>');`. Le script ne touche jamais une tâche sans le préfixe `ev_`.
7. **Arrêt** (maintenance, bascule vers un autre planificateur) : exécuter `supabase/ops/unschedule-crons.sql`. Il retire toutes les tâches `ev_` et laisse les secrets Vault et les extensions ; la reprise se fait en relançant `schedule-crons.sql`. Pendant l'arrêt : aucune notification n'est envoyée (elles restent en file et partent à la reprise, sauf les rappels dont l'échéance est passée, qui ne sont pas rattrapés), aucun paiement en attente n'est réconcilié.

**Changer `CRON_SECRET`** : mettre à jour l'hébergeur (redéploiement), puis le secret Vault, sans relancer le script (les tâches relisent Vault à chaque exécution) :

```sql
select vault.update_secret((select id from vault.secrets where name = 'ev_cron_secret'), '<nouvelle valeur de CRON_SECRET>');
```

Entre les deux mises à jour, les appels reçoivent 401 et sont simplement refaits au passage suivant. De même pour un changement de domaine avec `ev_app_url`.

**Sécurité** : pg_net garde l'en-tête de chaque requête dans sa file (`net.http_request_queue`) jusqu'à son envoi, quelques secondes. Le schéma `net` ne doit jamais être ajouté aux schémas exposés par l'API (**Settings > API > Exposed schemas** : `public` et `graphql_public` seulement).

### 7.3 Autres planificateurs (si l'hébergeur en fournit un)

Un seul planificateur à la fois : arrêter pg_cron (`unschedule-crons.sql`) avant d'en activer un autre. Les routes supportent un double appel (réservation des lignes en `FOR UPDATE SKIP LOCKED`, clés d'idempotence), mais la charge serait doublée.

- **Vercel (offre payante)** : fichier `vercel.json` déclarant les 8 routes avec les expressions du tableau 7.1, et la variable `CRON_SECRET` (Vercel l'envoie dans l'en-tête `Authorization`). L'offre gratuite limite les tâches planifiées à une par jour : insuffisant, et un `vercel.json` plus fréquent y fait échouer le déploiement. C'est pourquoi le fichier n'est pas versionné. La purge `ev_cron_history_purge` est alors sans objet.
- **Planificateur externe** (cron d'un serveur, service de tâches planifiées) : requête GET ou POST vers chaque route, aux fréquences du tableau 7.1, avec l'en-tête `Authorization` portant `CRON_SECRET`, stocké dans le coffre de secrets du planificateur (jamais dans une ligne de commande visible ni dans un fichier versionné).

## 8. Bootstrap du premier SUPERADMIN

Le rôle SUPERADMIN n'est **plus** attribué par l'inscription (l'ancien trigger le donnait à quiconque déclarait le téléphone 773780756, y compris en métadonnée). Procédure :

1. La personne désignée crée son compte par l'inscription normale de l'application (email et téléphone réels), puis vérifie son téléphone.
2. L'opérateur, sur son poste, avec les variables du projet de **production** chargées dans le shell :

   ```bash
   npx tsx scripts/bootstrap-superadmin.ts --phone +221XXXXXXXXX --operator "Prénom Nom de l'opérateur"
   ```

   Le script refuse si un SUPERADMIN existe déjà, attribue le rôle dans `user_roles`, met à jour le profil et journalise l'opération (`audit_logs`, action `SUPERADMIN_BOOTSTRAP`).
3. Les administrateurs suivants sont créés depuis l'administration (`/api/admin/users`), qui attribue désormais le rôle explicitement.
4. Vérifier : la personne se reconnecte et accède à `/admin` ; `03-verification.sql` reste entièrement `OK`.

## 9. Recette avant ouverture

- `03-verification.sql` : tout `OK`.
- `supabase/hotfix/2026-10-31-lot1a/04-smoke-test.md` contre le projet de production : résultats « attendu après ».
- Tâches planifiées : les 9 tâches actives, réponses 200 dans `net._http_response` (7.2, étape 5).
- Parcours manuels : inscription client avec OTP, inscription partenaire puis validation par l'administration, création d'un événement, achat d'un billet en paiement réel de faible montant (SMS de confirmation et notification dans la cloche dans la minute), scan par un contrôleur ; si les clés VAPID sont posées, activation du push et bouton d'essai.
- Lot 7 : `select count(*) from platform_settings;` donne 37, et les trois `features.*` valent `false` (`select key, value from platform_settings where key like 'features.%';`) ; `/halls` répond « page introuvable ». Sur un téléphone Android et un iPhone, installer l'application (`docs/installer-application.md`), ouvrir le billet de l'essai la veille avec du réseau, passer en mode avion, l'afficher par « Afficher mes billets hors ligne » : le QR change toutes les 20 secondes et le contrôleur, en ligne, le valide. Au scanner : un résultat plein écran par cas, une vibration sur Android, aucun son ; mode avion sur le téléphone du contrôleur : bandeau « Hors ligne : aucune entrée ne peut être validée » (`docs/guide-organisateur-entrees.md`).
- Lot 8 : aucune variable `EV_` dans l'hébergeur (5.3 ter) ; `/dev/paiements` répond « page introuvable » ; `select count(*) from payments where simulated;` et la même requête sur `cashouts` donnent 0.
- Lot 9 : contrôles après migration de 3 quater ; une invitation envoyée depuis l'onglet **Invitations** du pilotage, le SMS reçu et le billet scanné ; une photo envoyée puis supprimée sur la page profil (5.6) ; **un changement de numéro de bout en bout** : c'est le seul contrôle, sur un projet hébergé, des écritures sur `auth.sessions` et `auth.refresh_tokens` de `account_phone_finalize` (la CI les exerce sur une instance locale) ; une ligne d'audit `ACCOUNT_AUTH_DESYNC` signale une désynchronisation à réparer (`docs/lot9-rapport.md`).
- Lot 9 bis : contrôles après migration de 3 quinquies ; `select count(*) from platform_settings;` donne 40 ; chaque administrateur a ses permissions (contrôle 3 de 3 quinquies, refait après) ; un compte avec adresse email reçoit le lien de vérification, l'ouvre, et le profil affiche « Email vérifié » ; un achat réel de faible montant par Wave puis par Orange Money, avec l'email de confirmation ; si la signature des avis est activée, aucune ligne `REJECTED_SIGNATURE` (6.1) ; `/admin/finance`, section « Frais SamirPay », comparée au tableau de bord SamirPay.
- Lot 9 ter : contrôles après migration de 3 sexies ; `select count(*) from platform_settings;` donne 42 ; la page **Réglages de la plateforme** montre les deux réglages « Alerte de refus à une porte » (4 quinquies). Sur un événement d'essai à faible enjeu : une zone « Entrée générale » et une zone « Carré VIP » de type « Contrôle de zone », un contrôleur à chaque porte ; un billet VIP validé à l'entrée puis « Accès autorisé » au carré, un billet SIMPLE orienté au carré (« Accès refusé : billet SIMPLE »), un second passage refusé (« Déjà utilisé à …, … ») ; une invitation nommée validée par « Liste des invités » ; l'onglet **Entrées** du pilotage montre ces passages par zone, porte, catégorie et origine. Un achat réel par Wave puis par Orange Money ramène le client sur la page de suivi du paiement (6.2).
- Surveillance : journaux de l'hébergeur, **Logs > API** de Supabase et page **Notifications** de l'administration (SMS à l'issue incertaine, échecs) pendant les premiers jours.

## 10. Points ouverts d'exploitation

- Hébergeur de l'application à choisir ; la planification par la base (section 7) ne dépend pas de ce choix.
- Budget des SMS optionnels et `SMS_GLOBAL_DAILY_CAP` à fixer avec le client avant l'ouverture des ventes (5.5).
- SMS à l'issue incertaine (délai MTarget dépassé) : jamais renvoyés automatiquement ; leur vérification se fait auprès de MTarget, par l'opérateur (procédure à convenir avec le fournisseur).
- Email : compte Resend du client et domaine d'envoi vérifié à configurer ; d'ici là, le canal email reste désactivé. Depuis le lot 9 bis, tout message indispensable adressé à un compte part aussi par email quand l'adresse est vérifiée : suivre le volume face à la limite de l'offre Resend.
- SamirPay v1.2 : clé exacte de la signature des avis (6.1), vrai minimum d'encaissement (réglage `finance.min_paid_price`), limites de transfert du compte et acceptation de `successUrl` et `errorUrl` (6.2) à confirmer en bac à sable avant l'ouverture.
- Seuil de l'alerte de refus (4 quinquies) : 10 refus en 5 minutes par défaut, à ajuster après les premières grandes soirées (une porte très fréquentée peut l'atteindre sans fraude).
- Interrupteurs `features.*` : à ouvrir seulement quand le client aura validé les frais des salles, des tables et des commandes (4 ter).
- Lot de codes hors ligne : compressé par sa route depuis le lot 8 ; vérifier qu'aucun proxy de l'hébergeur ne retire `Content-Encoding` (5.6).
- Billet hors ligne sur iPhone : stockage de l'application installée séparé de celui de Safari, aucune vibration au scanner ; aucun test automatisé ne couvre l'iPhone (`docs/installer-application.md`).
