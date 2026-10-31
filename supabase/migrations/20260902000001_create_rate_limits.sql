-- Rate Limiting persistant pour protection anti-brute-force en serverless
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id bigserial PRIMARY KEY,
    identifier text NOT NULL,
    attempted_at timestamptz NOT NULL DEFAULT now(),
    locked_until timestamptz
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_at
    ON public.rate_limits (identifier, attempted_at DESC);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Nettoyage automatique des entrees > 1 heure (pg_cron ou appel periodique)
-- DELETE FROM public.rate_limits WHERE attempted_at < now() - interval '1 hour';
