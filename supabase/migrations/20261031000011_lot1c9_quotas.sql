-- ============================================================================
-- EVENT VILLAGE — LOT 1C.9 : compteurs de quota en base (anti-abus SMS, dépôts publics)
-- ============================================================================
-- Le limiteur historique (rate_limits) lit puis écrit en deux temps : une rafale passait. Ici,
-- public.quota_reserve(p_rules) réserve en UNE instruction par règle (INSERT … ON CONFLICT DO
-- UPDATE … WHERE hits < max), dans une sous-transaction : si une règle est dépassée, aucune
-- n'est consommée (tout ou rien). Ordre de verrouillage fixe (scope, bucket, fenêtre) : pas
-- d'interblocage entre deux réservations concurrentes.
-- Fenêtres fixes (début = multiple de la durée depuis l'époque Unix ; jour = jour UTC, soit
-- minuit à Dakar). EXECUTE réservé au service_role : un échec d'appel est traité par
-- l'application comme un refus (fail-closed).
--
-- p_rules : tableau JSON de { scope, bucket, window_secs, max }.
-- Retour : { allowed: true } ou { allowed: false, scope, bucket, retry_after_seconds }.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.quota_counters (
    scope TEXT NOT NULL,
    bucket TEXT NOT NULL,
    window_secs INTEGER NOT NULL CHECK (window_secs > 0),
    window_start TIMESTAMPTZ NOT NULL,
    hits INTEGER NOT NULL DEFAULT 0 CHECK (hits >= 0),
    PRIMARY KEY (scope, bucket, window_secs, window_start)
);

CREATE INDEX IF NOT EXISTS idx_quota_counters_window_start ON public.quota_counters (window_start);

ALTER TABLE public.quota_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quota_counters FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.quota_counters TO service_role;

COMMENT ON TABLE public.quota_counters IS
    'Compteurs de quota par portée et fenêtre fixe (lot 1C.9 : SMS par numéro, par IP, global ; dépôts publics). Service_role uniquement.';

CREATE OR REPLACE FUNCTION public.quota_reserve(p_rules jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r record;
    v_start timestamptz;
    v_hits integer;
    v_scope text;
    v_bucket text;
    v_retry integer;
BEGIN
    IF p_rules IS NULL OR jsonb_typeof(p_rules) <> 'array' OR jsonb_array_length(p_rules) = 0 THEN
        RAISE EXCEPTION 'quota_reserve : au moins une règle requise';
    END IF;

    BEGIN
        FOR r IN
            SELECT x.scope, x.bucket, x.window_secs, x.max
              FROM jsonb_to_recordset(p_rules) AS x(scope text, bucket text, window_secs integer, max integer)
             ORDER BY x.scope, x.bucket, x.window_secs
        LOOP
            IF r.scope IS NULL OR r.bucket IS NULL OR r.window_secs IS NULL OR r.window_secs <= 0 THEN
                RAISE EXCEPTION 'quota_reserve : règle incomplète %', row_to_json(r);
            END IF;
            v_scope := r.scope;
            v_bucket := r.bucket;
            v_start := to_timestamp(floor(extract(epoch FROM now()) / r.window_secs) * r.window_secs);
            v_retry := GREATEST(1, ceil(extract(epoch FROM (v_start + make_interval(secs => r.window_secs) - now())))::integer);
            IF COALESCE(r.max, 0) <= 0 THEN
                RAISE EXCEPTION 'quota atteint' USING ERRCODE = 'EV429';
            END IF;

            INSERT INTO public.quota_counters AS c (scope, bucket, window_secs, window_start, hits)
            VALUES (r.scope, r.bucket, r.window_secs, v_start, 1)
            ON CONFLICT (scope, bucket, window_secs, window_start)
            DO UPDATE SET hits = c.hits + 1 WHERE c.hits < r.max
            RETURNING c.hits INTO v_hits;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'quota atteint' USING ERRCODE = 'EV429';
            END IF;
        END LOOP;
    EXCEPTION WHEN SQLSTATE 'EV429' THEN
        -- Sous-transaction annulée : aucun compteur de cette réservation n'est consommé.
        RETURN jsonb_build_object('allowed', false, 'scope', v_scope, 'bucket', v_bucket, 'retry_after_seconds', v_retry);
    END;

    -- Purge opportuniste des fenêtres closes depuis plus de deux jours
    IF random() < 0.01 THEN
        DELETE FROM public.quota_counters WHERE window_start < now() - interval '2 days' - make_interval(secs => window_secs);
    END IF;

    RETURN jsonb_build_object('allowed', true);
END;
$$;

REVOKE ALL ON FUNCTION public.quota_reserve(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quota_reserve(jsonb) TO service_role;

COMMENT ON FUNCTION public.quota_reserve(jsonb) IS
    'Lot 1C.9 : réservation atomique, tout ou rien, sur plusieurs compteurs de quota. Service_role uniquement.';
