-- Finition 3d (recours et suppléance), point 2b et 2c — codes de secours du SUPERADMIN.
--
-- 1. Table public.admin_backup_codes : 10 codes à usage unique par SUPERADMIN, rangés en empreinte HMAC seulement
--    (64 caractères hexadécimaux, jamais le code en clair) ; un code sert une fois (used_at) ; régénérer annule les
--    anciens (revoked_at). Lecture et écriture : rôle de service seulement (RLS sans politique).
-- 2. Type d'avis ADMIN_BACKUP_CODE_USED : à chaque usage d'un code de secours, SMS d'alerte à l'ANCIEN numéro (celui du
--    compte au moment de l'usage, écrit dans la ligne d'envoi : un numéro changé ensuite ne le reçoit pas) et email.
-- 3. public.admin_backup_codes_generate(p) { user_id, session_id, device_key, hashes } : SUPERADMIN actif ; mot de passe et
--    code administrateur saisis depuis moins de 10 minutes (admin_identity_check) ; exactement 10 empreintes distinctes ;
--    anciens codes annulés ; journal ADMIN_BACKUP_CODES_GENERATED.
-- 4. public.admin_backup_codes_status(p) { user_id } : codes restants et date de création (lecture seule).
-- 5. public.admin_backup_code_use(p) { user_id, code_hash, session_id, device_key } : SUPERADMIN actif ; le code (de CE
--    compte, ni utilisé ni annulé) est consommé sous verrou (rejouer un code : refus) ; l'appareil est reconnu comme après
--    le code reçu par SMS (admin_device_verified) ; alerte (SMS à l'ancien numéro, email) et journal ADMIN_BACKUP_CODE_USED.
--    Le mot de passe et la limite des essais (deviner un code) sont vérifiés par la route (POST /api/admin/step-up/recovery).
--
-- Sans BEGIN ni COMMIT ; rejouable (IF NOT EXISTS, ON CONFLICT, CREATE OR REPLACE, REVOKE et GRANT idempotents).

CREATE TABLE IF NOT EXISTS public.admin_backup_codes (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    code_hash  text NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
    batch_id   uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    used_at    timestamptz,
    revoked_at timestamptz,
    CONSTRAINT admin_backup_codes_hash_key UNIQUE (code_hash)
);
CREATE INDEX IF NOT EXISTS admin_backup_codes_user_open_idx ON public.admin_backup_codes (user_id) WHERE used_at IS NULL AND revoked_at IS NULL;
ALTER TABLE public.admin_backup_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_backup_codes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_backup_codes TO service_role;

INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission) VALUES
    ('ADMIN_BACKUP_CODE_USED', 'ESSENTIAL', NULL, ARRAY['SMS','EMAIL'], 'ADMIN', 'ALLOW', FALSE, NULL)
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission;

CREATE OR REPLACE FUNCTION public.admin_backup_codes_generate(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user     uuid := public.try_uuid(p->>'user_id');
    v_identity text;
    v_hashes   text[];
    v_batch    uuid := gen_random_uuid();
    v_replaced integer := 0;
    v_now      timestamptz := clock_timestamp();
BEGIN
    IF v_user IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_user AND u.status::text = 'ACTIF')
       OR NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_user AND r.role::text = 'SUPERADMIN') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SUPERADMIN_ONLY', 'message', 'Les codes de secours sont réservés aux Superadmins.');
    END IF;
    v_identity := public.admin_identity_check(jsonb_build_object('user_id', v_user, 'session_id', p->>'session_id', 'device_key', p->>'device_key'));
    IF v_identity IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', v_identity,
            'message', CASE v_identity WHEN 'PASSWORD_CONFIRMATION_REQUIRED' THEN 'Par sécurité, saisissez votre mot de passe pour continuer.'
                                       ELSE 'Par sécurité, saisissez le code administrateur reçu par SMS pour continuer.' END);
    END IF;
    IF jsonb_typeof(p->'hashes') IS DISTINCT FROM 'array' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Codes illisibles.');
    END IF;
    SELECT array_agg(DISTINCT h) INTO v_hashes FROM jsonb_array_elements_text(p->'hashes') AS h WHERE h ~ '^[0-9a-f]{64}$';
    IF COALESCE(cardinality(v_hashes), 0) <> 10 OR jsonb_array_length(p->'hashes') <> 10 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Il faut exactement 10 codes distincts.');
    END IF;
    PERFORM 1 FROM public.users WHERE id = v_user FOR UPDATE;
    UPDATE public.admin_backup_codes SET revoked_at = v_now
     WHERE user_id = v_user AND used_at IS NULL AND revoked_at IS NULL;
    GET DIAGNOSTICS v_replaced = ROW_COUNT;
    INSERT INTO public.admin_backup_codes (user_id, code_hash, batch_id, created_at)
    SELECT v_user, h, v_batch, v_now FROM unnest(v_hashes) AS h;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_user, 'SUPERADMIN', 'ADMIN_BACKUP_CODES_GENERATED', 'users', v_user,
            jsonb_build_object('count', 10, 'replaced', v_replaced, 'batch_id', v_batch));
    RETURN jsonb_build_object('ok', true, 'remaining', 10, 'generated_at', v_now, 'replaced', v_replaced);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_backup_codes_generate(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_backup_codes_generate(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_backup_codes_status(p jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object('ok', true,
        'remaining', (SELECT count(*) FROM public.admin_backup_codes c
                       WHERE c.user_id = public.try_uuid(p->>'user_id') AND c.used_at IS NULL AND c.revoked_at IS NULL),
        'generated_at', (SELECT max(c.created_at) FROM public.admin_backup_codes c
                          WHERE c.user_id = public.try_uuid(p->>'user_id') AND c.revoked_at IS NULL));
$$;
REVOKE ALL ON FUNCTION public.admin_backup_codes_status(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_backup_codes_status(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_backup_code_use(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user      uuid := public.try_uuid(p->>'user_id');
    v_hash      text := btrim(COALESCE(p->>'code_hash', ''));
    v_session   uuid := public.try_uuid(p->>'session_id');
    v_device    text := btrim(COALESCE(p->>'device_key', ''));
    v_code      record;
    v_phone     text;
    v_remaining integer;
    v_verified  jsonb;
BEGIN
    IF v_user IS NULL OR v_session IS NULL OR v_hash !~ '^[0-9a-f]{64}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_user AND u.status::text = 'ACTIF')
       OR NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_user AND r.role::text = 'SUPERADMIN') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SUPERADMIN_ONLY');
    END IF;
    SELECT * INTO v_code FROM public.admin_backup_codes c
     WHERE c.user_id = v_user AND c.code_hash = v_hash AND c.used_at IS NULL AND c.revoked_at IS NULL
     FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_CODE');
    END IF;
    UPDATE public.admin_backup_codes SET used_at = clock_timestamp() WHERE id = v_code.id;
    -- L'appareil est reconnu comme après le code reçu par SMS (12 heures)
    v_verified := public.admin_device_verified(jsonb_build_object('user_id', v_user, 'device_key', v_device, 'session_id', v_session));
    IF (v_verified->>'ok') IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION USING ERRCODE = 'EV400', MESSAGE = 'Appareil non reconnu : ' || COALESCE(v_verified->>'code', '?');
    END IF;
    SELECT count(*) INTO v_remaining FROM public.admin_backup_codes c
     WHERE c.user_id = v_user AND c.used_at IS NULL AND c.revoked_at IS NULL;
    -- Alerte à l'ANCIEN numéro (celui du compte maintenant), écrit dans la ligne d'envoi, et email au compte
    SELECT u.phone INTO v_phone FROM public.users u WHERE u.id = v_user;
    PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
        'type', 'ADMIN_BACKUP_CODE_USED', 'key', 'ADMIN_BACKUP_CODE_USED:' || v_code.id::text,
        'user_id', v_user,
        'phone', CASE WHEN v_phone ~ '^\+?221[0-9]{9}$' THEN '+' || ltrim(v_phone, '+') END,
        'data', jsonb_build_object('remaining', v_remaining))));
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_user, 'SUPERADMIN', 'ADMIN_BACKUP_CODE_USED', 'users', v_user,
            jsonb_build_object('remaining', v_remaining, 'batch_id', v_code.batch_id));
    RETURN jsonb_build_object('ok', true, 'remaining', v_remaining);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_backup_code_use(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_backup_code_use(jsonb) TO service_role;
