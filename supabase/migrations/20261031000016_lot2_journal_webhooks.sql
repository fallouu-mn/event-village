-- ============================================================================
-- EVENT VILLAGE — LOT 2 : journal des webhooks SamirPay (2.1)
-- ============================================================================
-- payment_webhook_events : chaque webhook est enregistré avant traitement (corps brut, en-têtes
-- utiles, résultat) ; contrainte d'unicité sur le contenu reçu, rejeu compté (receive_count).
-- Ordre de verrouillage partout : paiement, puis catégories par identifiant croissant.
-- ============================================================================

-- ── payment_webhook_events ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL DEFAULT 'SAMIRPAY',
    dedupe_key TEXT NOT NULL UNIQUE CHECK (dedupe_key ~ '^[0-9a-f]{64}$'),
    raw_body TEXT NOT NULL,
    headers JSONB NOT NULL DEFAULT '{}'::jsonb,
    token_present BOOLEAN NOT NULL,
    order_id TEXT,
    transaction_id TEXT,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    result TEXT NOT NULL DEFAULT 'RECEIVED',
    result_detail TEXT,
    receive_count INTEGER NOT NULL DEFAULT 1,
    first_received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_order ON public.payment_webhook_events (order_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_payment ON public.payment_webhook_events (payment_id);
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payment_webhook_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.payment_webhook_events TO service_role;
COMMENT ON TABLE public.payment_webhook_events IS
    'Lot 2 : journal des webhooks SamirPay, enregistrés avant tout traitement (corps brut, en-têtes utiles, résultat). Service_role uniquement.';

-- ── Journal des webhooks ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.payment_webhook_record(
    p_dedupe_key text, p_raw_body text, p_headers jsonb, p_token_present boolean, p_order_id text, p_transaction_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row record;
BEGIN
    INSERT INTO public.payment_webhook_events (dedupe_key, raw_body, headers, token_present, order_id, transaction_id)
    VALUES (p_dedupe_key, p_raw_body, COALESCE(p_headers, '{}'::jsonb), p_token_present, p_order_id, p_transaction_id)
    ON CONFLICT (dedupe_key) DO UPDATE
        SET receive_count = public.payment_webhook_events.receive_count + 1, last_received_at = now()
    RETURNING id, receive_count INTO v_row;
    RETURN jsonb_build_object('id', v_row.id, 'receive_count', v_row.receive_count);
END;
$$;

-- Privilèges : service_role uniquement
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.payment_webhook_record(text, text, jsonb, boolean, text, text)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
