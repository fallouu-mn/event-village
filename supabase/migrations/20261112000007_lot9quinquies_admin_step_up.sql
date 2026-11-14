-- ============================================================================
-- EVENT VILLAGE — LOT 9 QUINQUIES : second facteur et sessions de l'administration (A3 : AUTH-05 ; A4 : AUTH-04)
-- ============================================================================
-- A3 (décision du chef de projet) : un code SMS est demandé aux ADMIN et au SUPERADMIN à l'ouverture de l'administration
--   sur un nouvel appareil, et après 12 heures. Le premier SUPERADMIN y est soumis comme les autres. Pas d'application
--   d'authentification pour l'instant.
-- A4 : après 30 minutes sans activité sur /admin, le mot de passe est redemandé (fenêtre, sans perdre la page) ; après
--   12 heures, mot de passe et code SMS. Les sessions des clients ne changent pas.
-- Règle appliquée au serveur (lib/admin/step-up.ts, verifyAdminAuth et requireActiveSession) par admin_step_up_check :
--   - mot de passe : saisi pour CETTE session depuis moins de 12 heures (password_confirmations : connexion par mot de
--     passe ; admin_session_activity.password_at : fenêtre de re-saisie), sinon ADMIN_PASSWORD_REQUIRED ;
--   - inactivité (administration seulement) : la dernière activité de la session (ou la dernière saisie du mot de passe)
--     date de moins de `idle_secs` (30 minutes par défaut), sinon ADMIN_PASSWORD_REQUIRED ;
--   - appareil : un code SMS vérifié sur CET appareil depuis moins de 12 heures (admin_devices ; appareil = empreinte du
--     cookie httpOnly de l'appareil, ou la session elle-même pour un client sans cookie), sinon ADMIN_SMS_REQUIRED.
--   Une vérification réussie en mode « activité » met à jour la dernière activité de la session.
-- Objets :
--   tables admin_devices (compte, appareil, heure du dernier code vérifié) et admin_session_activity (session, compte,
--     dernière activité) : service_role seul ;
--   table admin_step_up_codes et admin_step_up_code_store(p), admin_step_up_code_check(p) : code administrateur (jamais
--     dans otp_codes, dont la contrainte d'objet est gelée ; /api/auth/verify-otp ne le connaît donc pas) ;
--   admin_step_up_check(p) ; admin_device_verified(p).
-- Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_devices (
    user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    device_key      text NOT NULL CHECK (device_key ~ '^(dev:[0-9a-f]{64}|ses:[0-9a-f-]{36})$'),
    sms_verified_at timestamptz NOT NULL,
    PRIMARY KEY (user_id, device_key)
);
ALTER TABLE public.admin_devices ENABLE ROW LEVEL SECURITY;   -- aucune politique : service_role seul
REVOKE ALL ON TABLE public.admin_devices FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_devices TO service_role;
COMMENT ON TABLE public.admin_devices IS
    'Lot 9 quinquies (A3 : AUTH-05) : appareils sur lesquels un ADMIN ou le SUPERADMIN a saisi un code SMS administrateur (valable 12 h). Empreinte du cookie d''appareil seulement. service_role seul.';

CREATE TABLE IF NOT EXISTS public.admin_session_activity (
    session_id       uuid PRIMARY KEY,
    user_id          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    last_activity_at timestamptz NOT NULL,
    password_at      timestamptz
);
ALTER TABLE public.admin_session_activity ADD COLUMN IF NOT EXISTS password_at timestamptz;
ALTER TABLE public.admin_session_activity ENABLE ROW LEVEL SECURITY;   -- aucune politique : service_role seul
REVOKE ALL ON TABLE public.admin_session_activity FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_session_activity TO service_role;
COMMENT ON TABLE public.admin_session_activity IS
    'Lot 9 quinquies (A4 : AUTH-04) : dernière activité d''une session d''administration (mot de passe redemandé après 30 min sans activité). service_role seul.';

-- Code administrateur : table propre (la contrainte otp_codes_purpose_check est gelée, lot 9 ter A3) ; le code n'est jamais
-- un code de connexion (verify-otp ne lit que otp_codes). Empreinte HMAC seulement, 10 minutes, 5 essais, usage unique.
CREATE TABLE IF NOT EXISTS public.admin_step_up_codes (
    user_id    uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    code_hash  text NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
    expires_at timestamptz NOT NULL,
    attempts   integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.admin_step_up_codes ENABLE ROW LEVEL SECURITY;   -- aucune politique : service_role seul
REVOKE ALL ON TABLE public.admin_step_up_codes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_step_up_codes TO service_role;
COMMENT ON TABLE public.admin_step_up_codes IS
    'Lot 9 quinquies (A3 : AUTH-05) : code administrateur en cours (empreinte HMAC, 10 min, 5 essais, usage unique). service_role seul.';

-- p = { user_id, code_hash } → { ok, expires_at } : remplace le code en cours du compte
CREATE OR REPLACE FUNCTION public.admin_step_up_code_store(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user    uuid := public.try_uuid(p->>'user_id');
    v_hash    text := lower(btrim(COALESCE(p->>'code_hash', '')));
    v_expires timestamptz := clock_timestamp() + interval '10 minutes';
BEGIN
    IF v_user IS NULL OR v_hash !~ '^[0-9a-f]{64}$' OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_user) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    END IF;
    INSERT INTO public.admin_step_up_codes (user_id, code_hash, expires_at, attempts, created_at)
    VALUES (v_user, v_hash, v_expires, 0, clock_timestamp())
    ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0, created_at = EXCLUDED.created_at;
    RETURN jsonb_build_object('ok', true, 'expires_at', v_expires);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_step_up_code_store(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_step_up_code_store(jsonb) TO service_role;

-- p = { user_id, code_hash } → { ok: true } (code consommé) ou { ok: false, reason: INVALID | EXPIRED | TOO_MANY_ATTEMPTS }
CREATE OR REPLACE FUNCTION public.admin_step_up_code_check(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := public.try_uuid(p->>'user_id');
    v_hash text := lower(btrim(COALESCE(p->>'code_hash', '')));
    v_row  record;
BEGIN
    IF v_user IS NULL OR v_hash !~ '^[0-9a-f]{64}$' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'INVALID');
    END IF;
    SELECT c.code_hash, c.expires_at, c.attempts INTO v_row FROM public.admin_step_up_codes c WHERE c.user_id = v_user FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'INVALID');
    END IF;
    IF v_row.expires_at <= clock_timestamp() THEN
        DELETE FROM public.admin_step_up_codes WHERE user_id = v_user;
        RETURN jsonb_build_object('ok', false, 'reason', 'EXPIRED');
    END IF;
    IF v_row.attempts >= 5 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'TOO_MANY_ATTEMPTS');
    END IF;
    IF v_row.code_hash = v_hash THEN
        DELETE FROM public.admin_step_up_codes WHERE user_id = v_user;
        RETURN jsonb_build_object('ok', true);
    END IF;
    UPDATE public.admin_step_up_codes SET attempts = attempts + 1 WHERE user_id = v_user;
    RETURN jsonb_build_object('ok', false, 'reason', CASE WHEN v_row.attempts + 1 >= 5 THEN 'TOO_MANY_ATTEMPTS' ELSE 'INVALID' END);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_step_up_code_check(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_step_up_code_check(jsonb) TO service_role;

-- p = { user_id, session_id, device_key, idle_secs (null : pas de contrôle d'inactivité), touch (bool) }
--   → { ok: true } ou { ok: false, code: ADMIN_PASSWORD_REQUIRED | ADMIN_SMS_REQUIRED, reason }
CREATE OR REPLACE FUNCTION public.admin_step_up_check(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user     uuid := public.try_uuid(p->>'user_id');
    v_session  uuid := public.try_uuid(p->>'session_id');
    v_device   text := btrim(COALESCE(p->>'device_key', ''));
    v_idle     integer;
    v_touch    boolean := COALESCE((p->>'touch')::boolean, false);
    v_now      timestamptz := clock_timestamp();
    v_pwd_at   timestamptz;
    v_act_at   timestamptz;
    v_sms_at   timestamptz;
BEGIN
    BEGIN
        v_idle := NULLIF(p->>'idle_secs', '')::integer;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    END;
    IF v_user IS NULL OR v_session IS NULL OR v_device = '' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    END IF;
    SELECT GREATEST(
               (SELECT pc.confirmed_at FROM public.password_confirmations pc WHERE pc.session_id = v_session AND pc.user_id = v_user),
               (SELECT a.password_at FROM public.admin_session_activity a WHERE a.session_id = v_session AND a.user_id = v_user))
      INTO v_pwd_at;
    IF v_pwd_at IS NULL OR v_pwd_at < v_now - interval '12 hours' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ADMIN_PASSWORD_REQUIRED', 'reason', 'SESSION_12H');
    END IF;
    IF v_idle IS NOT NULL THEN
        SELECT a.last_activity_at INTO v_act_at FROM public.admin_session_activity a
         WHERE a.session_id = v_session AND a.user_id = v_user;
        IF GREATEST(v_pwd_at, COALESCE(v_act_at, v_pwd_at)) < v_now - make_interval(secs => v_idle) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'ADMIN_PASSWORD_REQUIRED', 'reason', 'IDLE');
        END IF;
    END IF;
    SELECT d.sms_verified_at INTO v_sms_at FROM public.admin_devices d WHERE d.user_id = v_user AND d.device_key = v_device;
    IF v_sms_at IS NULL OR v_sms_at < v_now - interval '12 hours' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ADMIN_SMS_REQUIRED', 'reason', CASE WHEN v_sms_at IS NULL THEN 'NEW_DEVICE' ELSE 'DEVICE_12H' END);
    END IF;
    IF v_touch THEN
        INSERT INTO public.admin_session_activity (session_id, user_id, last_activity_at) VALUES (v_session, v_user, v_now)
        ON CONFLICT (session_id) DO UPDATE SET last_activity_at = EXCLUDED.last_activity_at, user_id = EXCLUDED.user_id;
    END IF;
    RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_step_up_check(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_step_up_check(jsonb) TO service_role;

-- p = { user_id, device_key, session_id } : code SMS vérifié sur cet appareil ; l'activité de la session repart.
CREATE OR REPLACE FUNCTION public.admin_device_verified(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user    uuid := public.try_uuid(p->>'user_id');
    v_session uuid := public.try_uuid(p->>'session_id');
    v_device  text := btrim(COALESCE(p->>'device_key', ''));
    v_now     timestamptz := clock_timestamp();
BEGIN
    IF v_user IS NULL OR v_session IS NULL OR v_device !~ '^(dev:[0-9a-f]{64}|ses:[0-9a-f-]{36})$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    END IF;
    INSERT INTO public.admin_devices (user_id, device_key, sms_verified_at) VALUES (v_user, v_device, v_now)
    ON CONFLICT (user_id, device_key) DO UPDATE SET sms_verified_at = EXCLUDED.sms_verified_at;
    INSERT INTO public.admin_session_activity (session_id, user_id, last_activity_at) VALUES (v_session, v_user, v_now)
    ON CONFLICT (session_id) DO UPDATE SET last_activity_at = EXCLUDED.last_activity_at, user_id = EXCLUDED.user_id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_user, NULL, 'ADMIN_DEVICE_VERIFIED', 'users', v_user, jsonb_build_object('device', left(v_device, 4)));
    RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_device_verified(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_device_verified(jsonb) TO service_role;
