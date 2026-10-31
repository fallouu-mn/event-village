-- ============================================================================
-- EVENT VILLAGE — MIGRATION 20261031000001 : search_path EXPLICITE DES FONCTIONS
-- DÉCLENCHÉES DEPUIS auth.users (lot 0 — fondations de vérification)
-- ============================================================================
-- Problème : GoTrue (Supabase Auth) exécute ses requêtes avec le rôle
-- supabase_auth_admin, dont le search_path est `auth`. Le trigger
-- on_auth_user_created → handle_new_user() et la chaîne qu'il déclenche
-- (INSERT public.users → set_referral_code_on_insert → generate_referral_code ;
-- INSERT user_roles → sync_user_roles_to_jwt, audit_log_changes) utilisent des
-- noms NON qualifiés (user_roles, type user_role, audit_logs, fonctions…).
-- Sur une base vierge, chaque création d'utilisateur échoue donc avec
-- « Database error creating new user » (constaté en CI, run 41161003155).
--
-- Correction : fixer le search_path de ces fonctions. Aucun corps de fonction
-- ni aucune règle métier n'est modifié (les failles de handle_new_user restent
-- traitées au lot 3).
-- ============================================================================

ALTER FUNCTION public.handle_new_user() SET search_path = public, auth, extensions;
ALTER FUNCTION public.set_referral_code_on_insert() SET search_path = public, extensions;
ALTER FUNCTION public.generate_referral_code(UUID, TEXT) SET search_path = public, extensions;
ALTER FUNCTION public.sync_user_roles_to_jwt() SET search_path = public, auth, extensions;
ALTER FUNCTION public.audit_log_changes() SET search_path = public, auth, extensions;
ALTER FUNCTION public.handle_updated_at() SET search_path = public, extensions;
ALTER FUNCTION public.check_no_circular_referral() SET search_path = public, extensions;
