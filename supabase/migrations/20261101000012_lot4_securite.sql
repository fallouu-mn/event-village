-- ============================================================================
-- EVENT VILLAGE — LOT 4 : sécurité urgente (4.0) et limiteurs (4.8)
-- ============================================================================
-- Idempotente : peut être rejouée sans effet de bord.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 4.0 — public.users : plus aucune écriture REST par un compte ADMIN
-- ----------------------------------------------------------------------------
-- La politique users_admin_manage (0003_rls.sql:92-93, FOR ALL USING is_admin()) laissait tout ADMIN
-- supprimer puis recréer une ligne de public.users par REST, referral_status = 'AMBASSADEUR' compris
-- (le statut ambassadeur fixe les taux de commission) ; le lot 1B.2 n'avait retiré que UPDATE
-- (20261031000003_lot1b2_users_colonnes_protegees.sql:17-18), INSERT et DELETE restaient accordés à
-- authenticated. Test : tests/security/r15-statut-ambassadeur.test.ts.
--
-- Lecture admin conservée par users_select_policy (20261031000004_lot1b3_controleur_lectures.sql:35-36 :
-- id = auth.uid() OR is_admin()). Modification de son propre prénom, nom et photo conservée
-- (users_update_own + privilèges UPDATE par colonne du lot 1B.2).
--
-- Grep des écritures sur public.users (git grep -n -E "from\('users'\)" -- app components hooks lib,
-- puis les trois lignes suivantes) : toutes passent par getServiceRoleClient(), aucune par un client
-- anon ou authentifié :
--   app/api/admin/users/route.ts:149 (upsert), :304 (update)
--   app/api/admin/partners/[id]/status/route.ts:106 (update)
--   app/api/auth/register/route.ts:107 (upsert)
--   app/api/partner/register/route.ts:141 (upsert)
--   app/api/partner/team/invite/route.ts:261 (upsert)
--   lib/admin/admin.service.ts:366, :382, :400 (update, anonymisation)
--   lib/admin/bootstrap-superadmin.ts:62 (update)
-- Côté navigateur, lectures seules : app/login/page.tsx:189, app/register/page.tsx:163.
-- Fonctions SQL qui insèrent dans public.users : handle_new_user (SECURITY DEFINER, trigger d'auth).
-- Tests : écritures par un client service_role uniquement (partner-halls-m7, partner-orders-m9,
-- ux-performance-and-double-click, seed/seed-test, suites legacy).
DROP POLICY IF EXISTS "users_admin_manage" ON public.users;
REVOKE INSERT, DELETE, TRUNCATE ON TABLE public.users FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4.8 — limiteur historique supprimé (lib/security/rate-limiter.ts)
-- ----------------------------------------------------------------------------
-- Tous les limiteurs passent par public.quota_reserve (lot 1C.9). Grep
-- (git grep -n -E "rate_limits|auth_rate_limits" -- app lib components hooks middleware.ts scripts tests supabase) :
-- plus aucun lecteur ni écrivain, seulement les migrations de création (20260902000001_create_rate_limits.sql,
-- 0008_partner_auth_production.sql) ; auth_rate_limits n'a jamais été utilisée par le code.
DROP TABLE IF EXISTS public.rate_limits;
DROP TABLE IF EXISTS public.auth_rate_limits;
