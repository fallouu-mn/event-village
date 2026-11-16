-- ============================================================================
-- EVENT VILLAGE — Finition 3a (argent de l'administration), point 2 : solde SamirPay lu par le serveur, avec un cache de
-- 5 minutes partagé par toutes les instances de l'application
-- ============================================================================
-- « Retirable par Event Village » (SUPERADMIN seulement) part du solde du compte SamirPay (GET /api/tiers/payments/solde,
-- lib/samirpay/http-client.ts:290-299). Le serveur relit d'abord la dernière lecture de moins de 5 minutes ; sans elle, il
-- interroge SamirPay et enregistre la lecture (date et montant affichés à l'écran : « Solde lu à … »). Une lecture en
-- échec n'est jamais enregistrée : l'écran dit « Solde SamirPay illisible pour le moment » et n'affiche aucun chiffre.
-- Objets :
--   table samirpay_balance_reads (RLS activée, aucun droit pour anon ni authenticated : service_role seul) ;
--   finance_balance_cached(p_max_age_seconds, p_simulated) : dernière lecture assez récente du mode du serveur, ou NULL ;
--   finance_balance_record(p_solde, p_simulated) : enregistre une lecture et efface celles de plus de 90 jours.
-- Mode d'essai (lib/integrations/simulation.ts) : les lectures du faux service sont marquées et ne servent jamais à un
-- serveur réel. Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.samirpay_balance_reads (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    read_at timestamptz NOT NULL DEFAULT now(),
    solde numeric(14,2) NOT NULL,
    simulated boolean NOT NULL DEFAULT FALSE
);
COMMENT ON TABLE public.samirpay_balance_reads IS
    'Finition 3a : lectures du solde SamirPay par le serveur (cache de 5 minutes de « Retirable par Event Village »), gardées 90 jours. service_role seul.';
ALTER TABLE public.samirpay_balance_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.samirpay_balance_reads FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_samirpay_balance_reads_recent ON public.samirpay_balance_reads (simulated, read_at DESC);


CREATE OR REPLACE FUNCTION public.finance_balance_cached(p_max_age_seconds integer, p_simulated boolean)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object('solde', r.solde, 'read_at', r.read_at, 'cached', true)
      FROM public.samirpay_balance_reads r
     WHERE r.simulated = COALESCE(p_simulated, FALSE)
       AND r.read_at > now() - make_interval(secs => GREATEST(COALESCE(p_max_age_seconds, 300), 0))
       AND r.read_at <= now() + interval '1 minute'
     ORDER BY r.read_at DESC, r.id DESC
     LIMIT 1
$$;

COMMENT ON FUNCTION public.finance_balance_cached(integer, boolean) IS
    'Finition 3a : dernière lecture du solde SamirPay de moins de p_max_age_seconds (300 par défaut) pour le mode du serveur (réel ou essai), ou NULL. service_role uniquement.';
REVOKE ALL ON FUNCTION public.finance_balance_cached(integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finance_balance_cached(integer, boolean) TO service_role;


CREATE OR REPLACE FUNCTION public.finance_balance_record(p_solde numeric, p_simulated boolean)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r record;
BEGIN
    IF p_solde IS NULL THEN
        RAISE EXCEPTION 'finance_balance_record : solde absent' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.samirpay_balance_reads (solde, simulated)
    VALUES (round(p_solde, 2), COALESCE(p_simulated, FALSE))
    RETURNING solde, read_at INTO r;
    DELETE FROM public.samirpay_balance_reads WHERE read_at < now() - interval '90 days';
    RETURN jsonb_build_object('solde', r.solde, 'read_at', r.read_at, 'cached', false);
END;
$$;

COMMENT ON FUNCTION public.finance_balance_record(numeric, boolean) IS
    'Finition 3a : enregistre une lecture réussie du solde SamirPay (mode réel ou essai) et efface les lectures de plus de 90 jours. service_role uniquement.';
REVOKE ALL ON FUNCTION public.finance_balance_record(numeric, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finance_balance_record(numeric, boolean) TO service_role;
