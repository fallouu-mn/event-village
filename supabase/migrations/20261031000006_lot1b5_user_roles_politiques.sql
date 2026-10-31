-- ============================================================================
-- EVENT VILLAGE — LOT 1B.5 : politiques de user_roles sans récursion
-- ============================================================================
-- user_roles_select_own et user_roles_admin_manage interrogeaient user_roles depuis une
-- politique de user_roles : toute lecture authenticated échouait (42P17, infinite recursion
-- detected in policy). Le middleware retombait alors sur les rôles du jeton.
--
-- Lecture : ses propres rôles, ou tous pour un administrateur (is_admin(), SECURITY DEFINER,
-- lit user_roles en tant que propriétaire, donc sans RLS ni récursion).
--
-- Écriture : aucune par l'API REST. Écart assumé par rapport à « réécrire avec is_admin() » :
-- une politique d'écriture is_admin() permettrait à un ADMIN de s'attribuer SUPERADMIN par
-- REST. Toutes les écritures applicatives passent par le service_role (lib/auth/roles.ts,
-- routes serveur ; grep dans le rapport, section 1B.5).
-- ============================================================================

DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_manage" ON public.user_roles;

CREATE POLICY "user_roles_select_own" ON public.user_roles
    FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_roles FROM anon, authenticated;
