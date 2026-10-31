-- ============================================================================
-- EVENT VILLAGE — LOT 1C.3 : révocation réelle des sessions d'un utilisateur
-- ============================================================================
-- auth.admin.signOut(jwt, scope) attend le JWT de l'utilisateur ; les routes lui passaient son
-- identifiant : aucun effet. Il n'existe pas d'API d'administration GoTrue qui révoque les
-- sessions d'un compte par son identifiant en le conservant.
--
-- public.revoke_user_sessions(uuid) supprime ses sessions (auth.sessions) et révoque ses jetons
-- de rafraîchissement (auth.refresh_tokens). Le jeton d'accès déjà émis reste valable jusqu'à
-- son expiration (jwt_expiry, 1 h au plus) ; la RLS et les routes lisent user_roles et
-- users.status à chaque requête, ce qui suffit pour les droits.
-- Dépend du schéma interne de GoTrue : vérifié en CI par tests/parcours/revocation-sessions.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.revoke_user_sessions(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_sessions integer;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'revoke_user_sessions : p_user_id requis';
    END IF;

    UPDATE auth.refresh_tokens
       SET revoked = true, updated_at = now()
     WHERE user_id = p_user_id::text
       AND revoked IS DISTINCT FROM true;

    DELETE FROM auth.sessions WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_sessions = ROW_COUNT;
    RETURN v_sessions;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_user_sessions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_sessions(uuid) TO service_role;

COMMENT ON FUNCTION public.revoke_user_sessions(uuid) IS
    'Lot 1C.3 : supprime les sessions et révoque les jetons de rafraîchissement d''un compte. Service_role uniquement.';
