-- ============================================================================
-- EVENT VILLAGE — LOT 9 QUINQUIES : essais de mot de passe limités par compte (A1 : AUTH-01, T3)
-- ============================================================================
-- A1 (décision du chef de projet) : 10 échecs par 15 minutes et par compte, puis 429 avec le délai. La clé est le compte
--   résolu par le serveur (« user:<uuid> »), ou l'empreinte SHA-256 de l'identifiant saisi s'il n'existe pas
--   (« id:<hex> », jamais l'identifiant en clair) : même réponse dans les deux cas, l'existence du compte n'est pas
--   révélée. Au 10e échec, une fois par jour (jour de Dakar), SMS au titulaire (et email à une adresse vérifiée).
-- Fenêtre GLISSANTE de 15 minutes (une ligne par essai), et non une fenêtre fixe : l'attaquant ne gagne rien à viser
--   la bascule d'une fenêtre ; chaque essai est réservé AVANT la vérification du mot de passe, sous verrou consultatif
--   par clé : des essais simultanés ne dépassent pas la limite.
-- Objets :
--   table auth_login_attempts (clé, heure) : service_role seul ; une ligne par essai en cours ou échoué ;
--   auth_login_attempt_begin(p) : refuse (retry_after_seconds) s'il y a déjà 10 lignes dans les 15 minutes, sinon
--              réserve une ligne ;
--   auth_login_attempt_end(p) : SUCCESS ou ABORTED → la ligne est rendue (un succès ou une panne ne comptent pas) ;
--              FAILURE → la ligne reste ; au 10e échec d'un compte existant, ACCOUNT_LOGIN_FAILURES mis en file avec une
--              clé par jour de Dakar (une fois par jour) ;
--   registre : ACCOUNT_LOGIN_FAILURES (ESSENTIAL, SMS et EMAIL, ANY, BLOCK).
-- Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auth_login_attempts (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket      text NOT NULL CHECK (bucket ~ '^(user:[0-9a-f-]{36}|id:[0-9a-f]{64})$'),
    created_at  timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_bucket ON public.auth_login_attempts (bucket, created_at);

ALTER TABLE public.auth_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.auth_login_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.auth_login_attempts TO service_role;

COMMENT ON TABLE public.auth_login_attempts IS
    'Lot 9 quinquies (A1 : AUTH-01) : essais de mot de passe par compte (ou empreinte de l''identifiant saisi), fenêtre glissante de 15 minutes. Jamais l''identifiant en clair. Service_role seul.';

INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission) VALUES
    ('ACCOUNT_LOGIN_FAILURES',     'ESSENTIAL', NULL,            ARRAY['SMS','EMAIL'],                  'ANY',        'BLOCK', FALSE, NULL)
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission;


-- p = { bucket, max, window_secs } → { allowed: true, attempt_id } ou { allowed: false, retry_after_seconds }
CREATE OR REPLACE FUNCTION public.auth_login_attempt_begin(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bucket text := btrim(COALESCE(p->>'bucket', ''));
    v_max    integer;
    v_window integer;
    v_count  integer;
    v_oldest timestamptz;
    v_id     uuid;
BEGIN
    BEGIN
        v_max := (p->>'max')::integer;
        v_window := (p->>'window_secs')::integer;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Limite illisible.');
    END;
    IF v_bucket !~ '^(user:[0-9a-f-]{36}|id:[0-9a-f]{64})$' OR v_max IS NULL OR v_max < 1 OR v_window IS NULL OR v_window < 60 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande de limite incomplète.');
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('auth.login_attempts:' || v_bucket));
    SELECT count(*), min(a.created_at) INTO v_count, v_oldest
      FROM public.auth_login_attempts a
     WHERE a.bucket = v_bucket AND a.created_at > clock_timestamp() - make_interval(secs => v_window);
    IF v_count >= v_max THEN
        RETURN jsonb_build_object('ok', true, 'allowed', false,
            'retry_after_seconds', GREATEST(1, ceil(extract(epoch FROM (v_oldest + make_interval(secs => v_window) - clock_timestamp())))::integer));
    END IF;
    INSERT INTO public.auth_login_attempts (bucket) VALUES (v_bucket) RETURNING id INTO v_id;

    -- Purge opportuniste des essais de plus d'un jour
    IF random() < 0.02 THEN
        DELETE FROM public.auth_login_attempts WHERE created_at < clock_timestamp() - interval '1 day';
    END IF;
    RETURN jsonb_build_object('ok', true, 'allowed', true, 'attempt_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.auth_login_attempt_begin(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_login_attempt_begin(jsonb) TO service_role;


-- p = { attempt_id, outcome: SUCCESS | FAILURE | ABORTED, user_id?, max, window_secs } → { ok, failures, alerted }
CREATE OR REPLACE FUNCTION public.auth_login_attempt_end(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id      uuid;
    v_user    uuid;
    v_outcome text := btrim(COALESCE(p->>'outcome', ''));
    v_max     integer;
    v_window  integer;
    v_bucket  text;
    v_count   integer := 0;
    v_alerted integer := 0;
    v_day     text;
BEGIN
    BEGIN
        v_id := NULLIF(p->>'attempt_id', '')::uuid;
        v_user := NULLIF(p->>'user_id', '')::uuid;
        v_max := (p->>'max')::integer;
        v_window := (p->>'window_secs')::integer;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Fin d''essai illisible.');
    END;
    IF v_id IS NULL OR v_outcome NOT IN ('SUCCESS', 'FAILURE', 'ABORTED') OR v_max IS NULL OR v_window IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Fin d''essai incomplète.');
    END IF;

    SELECT a.bucket INTO v_bucket FROM public.auth_login_attempts a WHERE a.id = v_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ATTEMPT_NOT_FOUND', 'message', 'Essai introuvable.');
    END IF;
    IF v_outcome <> 'FAILURE' THEN
        DELETE FROM public.auth_login_attempts WHERE id = v_id;
        RETURN jsonb_build_object('ok', true, 'failures', NULL, 'alerted', 0);
    END IF;

    SELECT count(*) INTO v_count
      FROM public.auth_login_attempts a
     WHERE a.bucket = v_bucket AND a.created_at > clock_timestamp() - make_interval(secs => v_window);
    IF v_user IS NOT NULL AND v_bucket = 'user:' || v_user::text AND v_count >= v_max
       AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_user) THEN
        v_day := to_char(clock_timestamp() AT TIME ZONE 'Africa/Dakar', 'YYYY-MM-DD');
        v_alerted := public.notif_enqueue(jsonb_build_object(
            'type', 'ACCOUNT_LOGIN_FAILURES',
            'key', 'ACCOUNT_LOGIN_FAILURES:' || v_user::text || ':' || v_day,
            'user_id', v_user,
            'data', jsonb_build_object('day', v_day)
        ));
    END IF;
    RETURN jsonb_build_object('ok', true, 'failures', v_count, 'alerted', v_alerted);
END;
$$;

REVOKE ALL ON FUNCTION public.auth_login_attempt_end(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_login_attempt_end(jsonb) TO service_role;
