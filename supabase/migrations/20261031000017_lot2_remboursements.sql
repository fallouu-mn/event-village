-- ============================================================================
-- EVENT VILLAGE — LOT 2 : remboursements et module de cashout (2.7)
-- ============================================================================
-- cashouts : machine à états A_ENVOYER → ENVOYE → CONFIRME | ECHOUE | INCERTAIN, clé unique
-- (REFUND-<paymentId>), opérateur et numéro du payeur, jamais de valeur par défaut (blocage).
-- refund_request : crée le remboursement (refunds) et l'envoi (cashouts), idempotent.
-- Ordre de verrouillage partout : paiement, puis catégories par identifiant croissant.
-- ============================================================================

-- ── cashouts (module commun des envois d'argent) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.cashouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL CHECK (kind IN ('REFUND', 'EVENT_CANCELLATION_REFUND', 'WITHDRAWAL')),
    idempotency_key TEXT NOT NULL UNIQUE,
    payment_id UUID REFERENCES public.payments(id) ON DELETE RESTRICT,
    refund_id UUID REFERENCES public.refunds(id) ON DELETE SET NULL,
    withdrawal_id UUID REFERENCES public.withdrawals(id) ON DELETE SET NULL,
    beneficiary_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    operator TEXT CHECK (operator IS NULL OR operator IN ('WAVE', 'ORANGE_MONEY')),
    phone_number TEXT CHECK (phone_number IS NULL OR phone_number ~ '^[0-9]{9}$'),
    first_name TEXT,
    last_name TEXT,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL DEFAULT 'A_ENVOYER' CHECK (status IN ('A_ENVOYER', 'ENVOYE', 'CONFIRME', 'ECHOUE', 'INCERTAIN')),
    blocked_reason TEXT,
    send_started_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    samirpay_transaction_id TEXT,
    provider_status TEXT,
    last_error TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    alerted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cashouts_payment ON public.cashouts (payment_id);
CREATE INDEX IF NOT EXISTS idx_cashouts_status ON public.cashouts (status);
ALTER TABLE public.cashouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cashouts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.cashouts TO service_role;
COMMENT ON TABLE public.cashouts IS
    'Lot 2 : envois d''argent (remboursements ; retraits au lot 3). A_ENVOYER → ENVOYE → CONFIRME | ECHOUE | INCERTAIN ; INCERTAIN jamais renvoyé automatiquement. Service_role uniquement.';

-- ── Remboursement (refunds + cashout, clé unique par paiement) ──────────────
CREATE OR REPLACE FUNCTION public.refund_request(p_payment_id uuid, p_reason text, p_kind text DEFAULT 'REFUND')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pay record;
    v_user record;
    v_key text := 'REFUND-' || p_payment_id::text;
    v_refund_id uuid;
    v_cashout_id uuid;
    v_blocked text;
BEGIN
    SELECT id, client_id, amount, operator, payer_phone INTO v_pay FROM public.payments WHERE id = p_payment_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'refund_request : paiement % introuvable', p_payment_id; END IF;
    IF v_pay.amount <= 0 THEN RAISE EXCEPTION 'refund_request : montant nul, rien à rembourser'; END IF;
    SELECT first_name, last_name INTO v_user FROM public.users WHERE id = v_pay.client_id;

    v_blocked := CASE
        WHEN v_pay.operator IS NULL THEN 'OPERATOR_UNKNOWN'
        WHEN v_pay.payer_phone IS NULL THEN 'PHONE_UNKNOWN'
        WHEN NULLIF(btrim(v_user.first_name), '') IS NULL OR NULLIF(btrim(v_user.last_name), '') IS NULL THEN 'NAME_UNKNOWN'
        ELSE NULL END;

    INSERT INTO public.refunds (payment_id, refund_transaction_id, amount, reason, status)
    VALUES (p_payment_id, v_key, v_pay.amount, COALESCE(p_reason, 'Remboursement'), 'PENDING')
    ON CONFLICT (refund_transaction_id) DO NOTHING;
    SELECT id INTO v_refund_id FROM public.refunds WHERE refund_transaction_id = v_key;

    INSERT INTO public.cashouts (kind, idempotency_key, payment_id, refund_id, beneficiary_user_id, operator, phone_number, first_name, last_name, amount, blocked_reason)
    VALUES (p_kind, v_key, p_payment_id, v_refund_id, v_pay.client_id, v_pay.operator, v_pay.payer_phone,
            NULLIF(btrim(v_user.first_name), ''), NULLIF(btrim(v_user.last_name), ''), v_pay.amount, v_blocked)
    ON CONFLICT (idempotency_key) DO NOTHING;
    SELECT id INTO v_cashout_id FROM public.cashouts WHERE idempotency_key = v_key;
    RETURN v_cashout_id;
END;
$$;

-- Privilèges : service_role uniquement
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.refund_request(uuid, text, text)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
