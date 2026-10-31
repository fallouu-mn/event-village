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

-- A — rôle élevé réclamé dans les métadonnées d'inscription
SELECT 'A_metadata_role_eleve' AS controle,
       CASE WHEN ur.role IS NOT NULL THEN 'ALERTE' ELSE 'A_VERIFIER' END AS gravite,
       u.id::text AS objet_id,
       u.created_at AS cree_le,
       jsonb_build_object(
           'email', u.email, 'phone', u.phone,
           'metadata_role', u.raw_user_meta_data->>'role',
           'metadata_roles', u.raw_user_meta_data->'roles',
           'role_effectif_user_roles', ur.role,
           'derniere_connexion', u.last_sign_in_at,
           'confirmation_envoyee_le', u.confirmation_sent_at,
           'note', 'ALERTE = le rôle réclamé est réellement détenu dans user_roles'
       ) AS details
  FROM auth.users u
  LEFT JOIN public.user_roles ur
         ON ur.user_id = u.id AND ur.role::text = (u.raw_user_meta_data->>'role')
 WHERE u.raw_user_meta_data->>'role' IN ('ADMIN', 'SUPERADMIN', 'PARTENAIRE', 'CONTROLEUR')
    OR (u.raw_user_meta_data->'roles') ?| ARRAY['ADMIN', 'SUPERADMIN']

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
