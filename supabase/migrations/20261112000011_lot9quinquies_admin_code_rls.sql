-- ============================================================================
-- EVENT VILLAGE — LOT 9 QUINQUIES, correctifs de la contre-vérification, point 1 : le code administrateur vaut aussi pour
-- l'accès direct à la base (REST et temps réel)
-- ============================================================================
-- Constat (contre-vérification, run 177, tests/audit-auth/cv9qq-1 b) : un jeton ADMIN qui n'avait pas passé le code
--   administrateur lisait par la REST 5 comptes et 2 paiements d'autres personnes. Le code n'était exigé que par les
--   routes de l'application (lib/admin/step-up.ts) ; is_admin() (20261110000001_lot9ter_rls.sql:109-118) ne regardait que
--   le rôle et le statut du compte.
-- Règle : is_admin() et is_superadmin() (toutes les politiques de lecture réservées aux admins passent par elles, y
--   compris celles du temps réel, qui évalue la RLS avec le jeton de l'abonné) exigent en plus que la SESSION COURANTE
--   (session_id du jeton) ait passé le code administrateur depuis moins de 12 heures.
-- Objets :
--   table admin_session_codes (session, compte, heure du code qui a admis la session) : service_role seul ;
--   admin_session_code_valid() : vrai si la session du jeton courant a passé le code depuis moins de 12 heures ;
--   recopies : is_superadmin(), is_admin() (20261110000001_lot9ter_rls.sql:98-118) ; admin_step_up_check(p),
--     admin_device_verified(p) (20261112000007_lot9quinquies_admin_step_up.sql) ; changement : une session admise
--     (code vérifié sur l'appareil, ou appareil déjà vérifié depuis moins de 12 heures) est inscrite dans
--     admin_session_codes avec l'heure du code (celle de l'appareil : la session n'a pas plus de 12 heures de validité
--     que le code qui l'admet).
-- Les autres helpers de rôle (has_role, is_controller, auth_user_role) ne servent à aucune politique réservée aux admins
-- (is_controller exige en plus une affectation à l'événement : politique tickets_read).
-- Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_session_codes (
    session_id uuid PRIMARY KEY,
    user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    code_at    timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_session_codes_user ON public.admin_session_codes (user_id);
ALTER TABLE public.admin_session_codes ENABLE ROW LEVEL SECURITY;   -- aucune politique : service_role seul
REVOKE ALL ON TABLE public.admin_session_codes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_session_codes TO service_role;
COMMENT ON TABLE public.admin_session_codes IS
    'Lot 9 quinquies (contre-vérification, point 1) : sessions d''un ADMIN ou du SUPERADMIN admises par le code administrateur, avec l''heure du code (valable 12 h). Lue par is_admin() et is_superadmin(). service_role seul.';

CREATE OR REPLACE FUNCTION public.admin_session_code_valid()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(EXISTS (
        SELECT 1
          FROM public.admin_session_codes c
         WHERE c.session_id = public.try_uuid(auth.jwt() ->> 'session_id')
           AND c.user_id = auth.uid()
           AND c.code_at > now() - interval '12 hours'
    ), FALSE);
$$;
REVOKE ALL ON FUNCTION public.admin_session_code_valid() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_session_code_valid() TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.admin_session_code_valid() IS
    'Lot 9 quinquies (contre-vérification, point 1) : vrai si la session du jeton courant (session_id) a passé le code administrateur depuis moins de 12 heures.';

-- Recopie de 20261110000001_lot9ter_rls.sql:98-107 ; changement : code administrateur de la session exigé
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(public.has_role('SUPERADMIN')
                    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.status::text = 'ACTIF')
                    AND public.admin_session_code_valid(), FALSE);
$$;

-- Recopie de 20261110000001_lot9ter_rls.sql:109-118 ; changement : code administrateur de la session exigé
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((public.has_role('ADMIN') OR public.has_role('SUPERADMIN'))
                    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.status::text = 'ACTIF')
                    AND public.admin_session_code_valid(), FALSE);
$$;

COMMENT ON FUNCTION public.is_admin() IS
    'Lot 9 ter (0.1, D3), lot 9 quinquies (contre-vérification, point 1) : aide RLS. Vrai pour un ADMIN ou SUPERADMIN (user_roles) dont le compte est ACTIF ET dont la session courante a passé le code administrateur depuis moins de 12 heures.';
COMMENT ON FUNCTION public.is_superadmin() IS
    'Lot 9 ter (0.1, D3), lot 9 quinquies (contre-vérification, point 1) : aide RLS. Vrai pour un SUPERADMIN (user_roles) dont le compte est ACTIF ET dont la session courante a passé le code administrateur depuis moins de 12 heures.';
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- Recopie de 20261112000007_lot9quinquies_admin_step_up.sql (admin_step_up_check) ; changement : session admise inscrite
-- dans admin_session_codes avec l'heure du code de l'appareil.
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
    -- Contre-vérification (point 1) : la session est admise par le code de cet appareil
    INSERT INTO public.admin_session_codes (session_id, user_id, code_at) VALUES (v_session, v_user, v_sms_at)
    ON CONFLICT (session_id) DO UPDATE
        SET code_at = CASE WHEN admin_session_codes.user_id = EXCLUDED.user_id
                           THEN GREATEST(admin_session_codes.code_at, EXCLUDED.code_at) ELSE EXCLUDED.code_at END,
            user_id = EXCLUDED.user_id;
    RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_step_up_check(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_step_up_check(jsonb) TO service_role;

-- Recopie de 20261112000007_lot9quinquies_admin_step_up.sql (admin_device_verified) ; changement : la session qui vient de
-- saisir le code est inscrite dans admin_session_codes.
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
    INSERT INTO public.admin_session_codes (session_id, user_id, code_at) VALUES (v_session, v_user, v_now)
    ON CONFLICT (session_id) DO UPDATE SET code_at = EXCLUDED.code_at, user_id = EXCLUDED.user_id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_user, NULL, 'ADMIN_DEVICE_VERIFIED', 'users', v_user, jsonb_build_object('device', left(v_device, 4)));
    RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_device_verified(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_device_verified(jsonb) TO service_role;
