-- ============================================================================
-- EVENT VILLAGE — LOT 9 BIS : textes et préparation (contrat M11, sections 3.1 et 3.2 ; S-E, vague S3)
-- ============================================================================
-- Fonctions nouvelles du domaine E, écrites tâche après tâche (section 10) :
--   Tâche 42 (R85 ; contrat 5.42, 4.4, B89, décision D5) :
--     1. account_password_finalize(p jsonb) : après le changement du mot de passe par GoTrue, en une transaction :
--        autres sessions révoquées (même SQL que account_phone_finalize, 20261108000004_lot9_compte.sql:240-245),
--        session courante gardée et confirmée (password_confirmations, R57), journal ACCOUNT_PASSWORD_CHANGED.
-- Aucune fonction existante recopiée. Aucune table, aucune contrainte. Ordre des verrous : users FOR UPDATE, puis
-- auth.refresh_tokens et auth.sessions du compte, puis password_confirmations (clé étrangère vers users : FOR KEY
-- SHARE sur la ligne déjà tenue). Aucun BEGIN ni COMMIT ; rejouable (CREATE OR REPLACE).
-- ============================================================================


-- ============================================================================
-- Tâche 42 (R85) — 1. account_password_finalize (nouvelle)
-- ============================================================================
-- p = { user_id, keep_session_id } : tous deux obligatoires (jamais de révocation totale par défaut). Appelée par
-- POST /api/account/password APRÈS auth.admin.updateUserById : le mot de passe est déjà nouveau ; un échec ici se
-- rejoue sans effet de bord (révocation et confirmation idempotentes, un journal par appel réussi).
-- L'avis PASSWORD_CHANGED part du trigger on_auth_user_password_changed (lot 6), pas d'ici : un seul avis par canal.
-- Retour : { ok: true, sessions_revoked } ; { ok: false, code: INVALID_INPUT | USER_NOT_FOUND }.
CREATE OR REPLACE FUNCTION public.account_password_finalize(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uuid_re  constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
    v_user     uuid;
    v_keep     uuid;
    v_role     text;
    v_sessions integer;
BEGIN
    IF p IS NULL OR jsonb_typeof(p) <> 'object'
       OR COALESCE(p->>'user_id', '') !~ v_uuid_re
       OR COALESCE(p->>'keep_session_id', '') !~ v_uuid_re THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    END IF;
    v_user := (p->>'user_id')::uuid;
    v_keep := (p->>'keep_session_id')::uuid;

    SELECT u.role::text INTO v_role FROM public.users u WHERE u.id = v_user FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'USER_NOT_FOUND');
    END IF;

    -- Autres appareils déconnectés, session courante gardée (D5).
    UPDATE auth.refresh_tokens
       SET revoked = true, updated_at = now()
     WHERE user_id = v_user::text
       AND session_id IS DISTINCT FROM v_keep
       AND revoked IS DISTINCT FROM true;
    DELETE FROM auth.sessions WHERE user_id = v_user AND id <> v_keep;
    GET DIAGNOSTICS v_sessions = ROW_COUNT;

    -- La saisie de l'ancien mot de passe vaut confirmation récente pour la session courante (R57, 10 minutes) ; les
    -- confirmations des sessions fermées ne servent plus à rien.
    DELETE FROM public.password_confirmations WHERE user_id = v_user AND session_id <> v_keep;
    INSERT INTO public.password_confirmations (session_id, user_id, confirmed_at)
    VALUES (v_keep, v_user, now())
    ON CONFLICT (session_id) DO UPDATE
        SET confirmed_at = EXCLUDED.confirmed_at
      WHERE public.password_confirmations.user_id = EXCLUDED.user_id;

    -- Journal dans la transaction (ex-10.0 c) ; aucun secret, aucun identifiant de session.
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_user, v_role, 'ACCOUNT_PASSWORD_CHANGED', 'users', v_user,
            jsonb_build_object('sessions_revoked', v_sessions));

    RETURN jsonb_build_object('ok', true, 'sessions_revoked', v_sessions);
END;
$$;

REVOKE ALL ON FUNCTION public.account_password_finalize(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_password_finalize(jsonb) TO service_role;
COMMENT ON FUNCTION public.account_password_finalize(jsonb) IS
    'Lot 9 bis (R85) : après un changement de mot de passe, autres sessions révoquées, session courante confirmée, journal ACCOUNT_PASSWORD_CHANGED.';
