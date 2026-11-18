-- Contre-vérification de la finition 3d, T3 — la REST et le temps réel suivent la règle des 30 minutes des routes.
-- Constat (cvf3d-6 b) : un admin inactif depuis 31 minutes était arrêté par les routes (admin_step_up_check : IDLE), mais
-- lisait toujours par la REST et recevait le temps réel : admin_session_code_valid() ne regardait pas l'activité.
-- Correctif :
--   admin_session_activity.idle_secs : durée d'inactivité appliquée par la route qui a touché la session en dernier
--     (ADMIN_IDLE_TIMEOUT_MINUTES de l'application, 5 à 240 minutes ; 30 par défaut). Une seule règle : celle de
--     l'application, lue par la route et gardée ici, pour la base ;
--   admin_step_up_check (recopie de 20261112000011) : en touchant la session, garde aussi idle_secs ;
--   admin_session_code_valid() (recopie de 20261120000007) : exige en plus une activité plus récente que cette durée
--     (30 minutes si la session n'en a pas encore) : plus grande des heures de la dernière activité et du dernier mot de
--     passe saisi, comme admin_step_up_check. Toujours une seule requête, sur clés primaires (session du jeton), STABLE.
-- Sans BEGIN ni COMMIT ; rejouable (ADD COLUMN IF NOT EXISTS, contrainte posée une fois, CREATE OR REPLACE).

ALTER TABLE public.admin_session_activity ADD COLUMN IF NOT EXISTS idle_secs integer;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_session_activity_idle_secs_check'
                     AND conrelid = 'public.admin_session_activity'::regclass) THEN
        ALTER TABLE public.admin_session_activity
            ADD CONSTRAINT admin_session_activity_idle_secs_check CHECK (idle_secs IS NULL OR idle_secs BETWEEN 300 AND 14400);
    END IF;
END;
$$;
COMMENT ON COLUMN public.admin_session_activity.idle_secs IS
    'Finition 3d (contre-vérification, T3) : durée d''inactivité (secondes) appliquée par la dernière route qui a touché la session ; admin_session_code_valid() applique la même à la REST et au temps réel (1 800 s si vide).';

-- Recopie de 20261112000011_lot9quinquies_admin_code_rls.sql ; ajout : idle_secs gardé en touchant la session
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
        -- Finition 3d (contre-vérification, T3) : la durée d'inactivité de la route (idle_secs) est gardée avec l'activité ;
        -- admin_session_code_valid() applique la même à la REST et au temps réel.
        INSERT INTO public.admin_session_activity (session_id, user_id, last_activity_at, idle_secs)
        VALUES (v_session, v_user, v_now, CASE WHEN v_idle BETWEEN 300 AND 14400 THEN v_idle END)
        ON CONFLICT (session_id) DO UPDATE
            SET last_activity_at = EXCLUDED.last_activity_at, user_id = EXCLUDED.user_id,
                idle_secs = COALESCE(EXCLUDED.idle_secs, admin_session_activity.idle_secs);
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

-- Recopie de 20261120000007_f3d_cv_revocation.sql ; ajout : activité de la session plus récente que la durée d'inactivité
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
          JOIN auth.sessions s ON s.id = c.session_id AND s.user_id = c.user_id
          JOIN public.admin_session_activity a ON a.session_id = c.session_id AND a.user_id = c.user_id
         WHERE c.session_id = public.try_uuid(auth.jwt() ->> 'session_id')
           AND c.user_id = auth.uid()
           AND c.code_at > now() - interval '12 hours'
           AND GREATEST(a.last_activity_at, COALESCE(a.password_at, a.last_activity_at))
               > now() - make_interval(secs => COALESCE(a.idle_secs, 1800))
    ), FALSE);
$$;
REVOKE ALL ON FUNCTION public.admin_session_code_valid() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_session_code_valid() TO service_role;
COMMENT ON FUNCTION public.admin_session_code_valid() IS
    'Lot 9 quinquies (contre-vérification, point 1) ; finition 3d (contre-vérification, T2 et T3) : vrai si la session du jeton courant existe encore (auth.sessions), a passé le code administrateur depuis moins de 12 heures et a eu une activité plus récente que sa durée d''inactivité (admin_session_activity.idle_secs, 30 minutes par défaut).';
