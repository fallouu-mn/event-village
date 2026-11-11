-- ============================================================================
-- EVENT VILLAGE — LOT 9 BIS : textes et préparation (contrat M11, sections 3.1 et 3.2 ; S-E, vague S3)
-- ============================================================================
-- Fonctions nouvelles du domaine E, écrites tâche après tâche (section 10) :
--   Tâche 42 (R85 ; contrat 5.42, 4.4, B89, décision D5) :
--     1. account_password_finalize(p jsonb) : après le changement du mot de passe par GoTrue, en une transaction :
--        autres sessions révoquées (même SQL que account_phone_finalize, 20261108000004_lot9_compte.sql:240-245),
--        session courante gardée et confirmée (password_confirmations, R57), journal ACCOUNT_PASSWORD_CHANGED.
--   Tâche 43 (R98 ; contrat 5.43, B90, décision D6) :
--     2. quota_release(p_rules jsonb) : rend une unité réservée par quota_reserve (20261031000011_lot1c9_quotas.sql:35-92)
--        quand l'action comptée n'a pas eu lieu (SMS d'invitation non parti) ; fenêtre courante seulement.
-- Aucune fonction existante recopiée. Aucune table, aucune contrainte. Ordre des verrous : users FOR UPDATE, puis
-- auth.refresh_tokens et auth.sessions du compte, puis password_confirmations (clé étrangère vers users : FOR KEY
-- SHARE sur la ligne déjà tenue) ; quota_release ne verrouille que les lignes de quota_counters qu'elle décrémente,
-- dans l'ordre (scope, bucket, window_secs) de quota_reserve. Aucun BEGIN ni COMMIT ; rejouable (CREATE OR REPLACE).
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


-- ============================================================================
-- Tâche 43 (R98) — 2. quota_release (nouvelle)
-- ============================================================================
-- p_rules : tableau JSON de { scope, bucket, window_secs } (mêmes règles que la réservation ; max ignoré). Pour chaque
-- règle, une unité est rendue sur la fenêtre COURANTE, calculée comme quota_reserve, si son compteur est positif. Une
-- fenêtre changée entre la réservation et le rendu ne rend rien (l'unité appartient à la fenêtre close) : la règle est
-- comptée dans not_released, que l'appelant journalise. Ordre des lignes : (scope, bucket, window_secs), comme
-- quota_reserve, donc sans interblocage entre une réservation et un rendu concurrents.
-- Retour : { released, not_released }. Règle incomplète : exception (erreur de programmation, jamais un refus).
CREATE OR REPLACE FUNCTION public.quota_release(p_rules jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r              record;
    v_start        timestamptz;
    v_released     integer := 0;
    v_not_released integer := 0;
BEGIN
    IF p_rules IS NULL OR jsonb_typeof(p_rules) <> 'array' THEN
        RAISE EXCEPTION 'quota_release : tableau de règles requis' USING ERRCODE = '22023';
    END IF;

    FOR r IN
        SELECT x.scope, x.bucket, x.window_secs
          FROM jsonb_to_recordset(p_rules) AS x(scope text, bucket text, window_secs integer)
         ORDER BY x.scope, x.bucket, x.window_secs
    LOOP
        IF r.scope IS NULL OR r.bucket IS NULL OR r.window_secs IS NULL OR r.window_secs <= 0 THEN
            RAISE EXCEPTION 'quota_release : règle incomplète %', row_to_json(r) USING ERRCODE = '22023';
        END IF;
        v_start := to_timestamp(floor(extract(epoch FROM now()) / r.window_secs) * r.window_secs);

        UPDATE public.quota_counters AS c
           SET hits = c.hits - 1
         WHERE c.scope = r.scope
           AND c.bucket = r.bucket
           AND c.window_secs = r.window_secs
           AND c.window_start = v_start
           AND c.hits > 0;
        IF FOUND THEN
            v_released := v_released + 1;
        ELSE
            v_not_released := v_not_released + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('released', v_released, 'not_released', v_not_released);
END;
$$;

REVOKE ALL ON FUNCTION public.quota_release(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quota_release(jsonb) TO service_role;
COMMENT ON FUNCTION public.quota_release(jsonb) IS
    'Lot 9 bis (R98) : rend une unité de quota de la fenêtre courante quand l''action comptée n''a pas eu lieu. Service_role uniquement.';
