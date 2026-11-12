-- ============================================================================
-- EVENT VILLAGE — LOT 9 TER, TÂCHE 9t.1 : aucune écriture REST dans public (consigne 0.1, arbitrages 1 à 5)
-- ============================================================================
-- Applicable seule et en premier, indépendante des autres migrations du lot. Aucune donnée modifiée.
-- Base des recopies : is_superadmin M/20260906000004_user_roles_multi_role.sql:202-205, is_admin :208-211,
-- search_path M/20261031000002_lot1a_failles_sans_privilege.sql:122 (ALTER FUNCTION … SET search_path = public).
--
-- Constat (contrat A.1.1) : partners_update_owner (M/0003_rls.sql:115-116, sans WITH CHECK, aucun REVOKE sur
-- partners) laissait une partenaire écrire toute colonne de sa fiche par PATCH /rest/v1/partners, dont status ;
-- 25 politiques d'écriture au total (tableau A du contrat), et les droits INSERT, UPDATE, DELETE, TRUNCATE par
-- défaut de Supabase pour anon et authenticated sur 29 relations (sortie [RLS-ECRITURES] du run 128).
-- Le navigateur n'écrit dans aucune table de public : toutes les écritures légitimes passent par les routes
-- serveur (service_role) et les RPC, que cette migration ne touche pas. Politiques SELECT inchangées (sauf 6).
--
--  1. suppression des 25 politiques d'écriture (INSERT, UPDATE, DELETE, ALL), y compris celles de l'admin ;
--  2. REVOKE INSERT, UPDATE, DELETE, TRUNCATE à PUBLIC, anon et authenticated sur toute relation de public
--     (tables, tables partitionnées, vues, vues matérialisées, tables étrangères ; hors relations d'extension) ;
--  3. privilèges par défaut : une relation créée plus tard par postgres n'accorde aucune écriture à anon ni à
--     authenticated (forme par schéma et forme globale) ;
--  4. D3 : is_admin() et is_superadmin() exigent un compte ACTIF (users.status). Même nom, même signature, même
--     volatilité, SECURITY DEFINER et search_path répétés (CREATE OR REPLACE remettrait search_path à défaut) ;
--     aides RLS du groupe a : exécutables par anon et authenticated (évaluées dans les politiques) ;
--  5. garde finale : la migration échoue en nommant chaque politique d'écriture, droit d'écriture ou privilège par
--     défaut d'écriture restant pour anon ou authenticated dans public.
-- Rejouable : DROP POLICY IF EXISTS, REVOKE et ALTER DEFAULT PRIVILEGES idempotents, CREATE OR REPLACE.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Les 25 politiques d'écriture (tableau A du contrat, dernière définition de chacune)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_update_own" ON public.users;                                   -- M/20260906000004:443
DROP POLICY IF EXISTS "subscription_plans_admin_manage" ON public.subscription_plans;       -- M/0003_rls.sql:102
DROP POLICY IF EXISTS "partners_insert_auth" ON public.partners;                            -- M/0003_rls.sql:112
DROP POLICY IF EXISTS "partners_update_owner" ON public.partners;                           -- M/0003_rls.sql:115
DROP POLICY IF EXISTS "partners_delete_superadmin" ON public.partners;                      -- M/0003_rls.sql:118
DROP POLICY IF EXISTS "partner_activities_manage" ON public.partner_activities;             -- M/0003_rls.sql:128
DROP POLICY IF EXISTS "halls_partner_manage" ON public.halls;                               -- M/0003_rls.sql:174
DROP POLICY IF EXISTS "hall_reservations_update" ON public.hall_reservations;               -- M/0003_rls.sql:187
DROP POLICY IF EXISTS "restaurant_zones_manage" ON public.restaurant_zones;                 -- M/0003_rls.sql:201
DROP POLICY IF EXISTS "restaurant_tables_manage" ON public.restaurant_tables;               -- M/0003_rls.sql:207
DROP POLICY IF EXISTS "table_reservations_update" ON public.table_reservations;             -- M/0003_rls.sql:220
DROP POLICY IF EXISTS "product_categories_manage" ON public.product_categories;             -- M/0003_rls.sql:234
DROP POLICY IF EXISTS "products_manage" ON public.products;                                 -- M/0003_rls.sql:240
DROP POLICY IF EXISTS "orders_update" ON public.orders;                                     -- M/0003_rls.sql:253
DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;                           -- M/0003_rls.sql:264
DROP POLICY IF EXISTS "payments_admin_update" ON public.payments;                           -- M/0003_rls.sql:284
DROP POLICY IF EXISTS "refunds_admin_manage" ON public.refunds;                             -- M/0003_rls.sql:293
DROP POLICY IF EXISTS "referral_config_admin_manage" ON public.referral_config;             -- M/0003_rls.sql:303
DROP POLICY IF EXISTS "referral_commissions_admin_manage" ON public.referral_commissions;   -- M/0003_rls.sql:322
DROP POLICY IF EXISTS "withdrawals_admin_manage" ON public.withdrawals;                     -- M/0003_rls.sql:335
DROP POLICY IF EXISTS "admin_permissions_superadmin_all" ON public.admin_permissions;       -- M/0007_superadmin_complete.sql:103
DROP POLICY IF EXISTS "platform_settings_admin_write" ON public.platform_settings;          -- M/20261105000001:146
DROP POLICY IF EXISTS "campaigns_admin_manage" ON public.campaigns;                         -- M/0007_superadmin_complete.sql:115
DROP POLICY IF EXISTS "Admins manage promotions" ON public.sponsored_promotions;            -- M/20260902000003:32
DROP POLICY IF EXISTS "ticket_categories_admin_manage" ON public.ticket_categories;         -- M/20261105000003:76


-- ----------------------------------------------------------------------------
-- 2. Aucune écriture pour PUBLIC, anon ni authenticated sur une relation de public (E2, X19). Un REVOKE de table
--    retire aussi les droits de colonne correspondants. Les relations d'une extension sont laissées à l'extension.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT c.oid::regclass AS rel
          FROM pg_class c
         WHERE c.relnamespace = 'public'::regnamespace
           AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
           AND NOT EXISTS (SELECT 1 FROM pg_depend d
                            WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e')
         ORDER BY c.relname
    LOOP
        EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE %s FROM PUBLIC, anon, authenticated', r.rel);
    END LOOP;
END;
$$;


-- ----------------------------------------------------------------------------
-- 3. Relations futures créées par postgres (D2 ; patron M/20261031000002:139-140 pour les fonctions). La forme par
--    schéma retire les droits accordés par Supabase dans public ; la forme globale garantit qu'aucun droit global
--    ne s'y ajoute (un droit par défaut global ne se retire pas par schéma).
-- ----------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon, authenticated;


-- ----------------------------------------------------------------------------
-- 4. D3 : aides RLS exigeant un compte ACTIF. Recopies de M/20260906000004:202-205 (is_superadmin) et :208-211
--    (is_admin), seule la condition « compte ACTIF » est ajoutée. SECURITY DEFINER : la lecture de users se fait
--    avec les droits du propriétaire (aucune récursion par users_select_policy, qui appelle is_admin()).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(public.has_role('SUPERADMIN')
                    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.status::text = 'ACTIF'), FALSE);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((public.has_role('ADMIN') OR public.has_role('SUPERADMIN'))
                    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.status::text = 'ACTIF'), FALSE);
$$;

COMMENT ON FUNCTION public.is_admin() IS
    'Lot 9 ter (0.1, D3) : aide RLS du groupe a. Vrai pour un ADMIN ou SUPERADMIN (user_roles) dont le compte est ACTIF ; faux pour anon et pour un compte suspendu, en attente ou supprimé.';
COMMENT ON FUNCTION public.is_superadmin() IS
    'Lot 9 ter (0.1, D3) : aide RLS du groupe a. Vrai pour un SUPERADMIN (user_roles) dont le compte est ACTIF.';

-- Groupe a (M/20261031000002:123) : droits inchangés par CREATE OR REPLACE, répétés explicitement.
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 5. Garde finale : échec explicite si une écriture REST reste possible (y compris une dérive faite à la main).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v text;
BEGIN
    SELECT string_agg(x, ' ; ' ORDER BY x) INTO v FROM (
        SELECT format('politique %s.%s (%s)', p.tablename, p.policyname, p.cmd) AS x
          FROM pg_policies p
         WHERE p.schemaname = 'public' AND p.cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
        UNION ALL
        SELECT format('droit %s %s sur %s', r.rol, k.priv, c.relname)
          FROM pg_class c
          CROSS JOIN (VALUES ('anon'::name), ('authenticated'::name)) r(rol)
          CROSS JOIN (VALUES ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) k(priv)
         WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
           AND CASE WHEN k.priv IN ('INSERT', 'UPDATE') THEN has_any_column_privilege(r.rol, c.oid, k.priv)
                    ELSE has_table_privilege(r.rol, c.oid, k.priv) END
        UNION ALL
        SELECT format('privilège par défaut %s %s%s', a.grantee::regrole, a.privilege_type,
                      CASE WHEN d.defaclnamespace = 0::oid THEN ' (global)' ELSE '' END)
          FROM pg_default_acl d
          CROSS JOIN LATERAL aclexplode(d.defaclacl) a
         WHERE d.defaclrole = 'postgres'::regrole::oid
           AND d.defaclnamespace IN (0::oid, 'public'::regnamespace::oid)
           AND d.defaclobjtype = 'r'
           AND a.grantee IN ('anon'::regrole::oid, 'authenticated'::regrole::oid)
           AND a.privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
    ) s;
    IF v IS NOT NULL THEN
        RAISE EXCEPTION 'lot 9 ter (0.1) : écritures REST encore possibles : %', v;
    END IF;
END;
$$;


-- ----------------------------------------------------------------------------
-- 6. users_select_policy (dernière définition M/20261031000004_lot1b3_controleur_lectures.sql:34-36) : mêmes lignes
--    visibles, mêmes rôles, auth.uid() et is_admin() lus une fois par requête (sous-requêtes scalaires) au lieu d'une
--    fois par ligne de users.
--    Cause (runs 131 et 132, temps-reel-billets) : la garde « compte non suspendu » des politiques de lecture
--    (EXISTS sur users WHERE u.id = auth.uid(), M/20261103000001_lot6_dette.sql) ne prend pas l'index de users sous
--    RLS : auth.uid(), mis en ligne, contient un COALESCE que le planificateur tient pour non étanche ; users est
--    parcourue en entier et users_select_policy évaluée par ligne, soit un appel de is_admin() par compte (corps
--    alourdi d'une sous-requête par D3, section 4). Realtime refait ce contrôle pour chaque abonné authentifié de
--    chaque changement : environ 0,5 s par abonné d'après les horodatages des runs 131 et 132, billets et
--    notifications livrés en 1,6 à 7,9 s.
--    Rejouable : DROP POLICY IF EXISTS puis CREATE POLICY.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT USING (id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
