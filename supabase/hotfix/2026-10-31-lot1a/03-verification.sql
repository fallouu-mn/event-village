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
    -- Lot 7 (D21) : 7e aide RLS, ticket_category_private_read (politiques de ticket_categories sans lecture de users)
    VALUES ('is_admin'), ('is_superadmin'), ('is_controller'), ('has_role'), ('is_partner_owner'), ('auth_user_role'),
           ('ticket_category_private_read'),
    -- Lot 9 quinquies, contre-vérification (point 4) : 8e aide RLS, controller_assignment_active (politique tickets_read)
           ('controller_assignment_active')
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
           AND (SELECT COUNT(DISTINCT proname) FROM fns WHERE proname IN (SELECT name FROM whitelist)) = 7,
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
