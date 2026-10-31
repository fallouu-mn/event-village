-- ============================================================================
-- EVENT VILLAGE — LOT 1B.2 : public.users, colonnes modifiables par l'utilisateur
-- ============================================================================
-- users_update_own (USING id = auth.uid()) bloquait déjà role et referral_status par sa
-- clause WITH CHECK, mais laissait l'utilisateur modifier par l'API REST :
--   status (un compte SUSPENDU se réactivait lui-même), phone et email (la connexion par
--   téléphone résout l'email depuis users.phone), referral_code.
--
-- Privilèges par colonne : par l'API REST, un utilisateur ne modifie que prénom, nom et photo.
-- (Aucune colonne « préférences » n'existe sur public.users.)
-- Dépendances vérifiées par grep (rapport, section 1B.2) : aucune écriture applicative sur
-- public.users ne passe par un client anon / authenticated ; toutes utilisent le service_role.
-- Les changements de téléphone / d'email ne sont pas proposés par l'interface (profil en
-- lecture seule) : ils restent bloqués jusqu'à une route serveur avec OTP (§153).
-- ============================================================================

REVOKE UPDATE ON TABLE public.users FROM anon, authenticated;
GRANT UPDATE (first_name, last_name, avatar_url) ON TABLE public.users TO authenticated;
