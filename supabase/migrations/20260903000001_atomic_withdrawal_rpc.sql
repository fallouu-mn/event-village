-- =============================================================================
-- MIGRATION : Retrait atomique avec verrou consultatif (anti-race-condition)
-- Fix : TOCTOU (Time-of-check / Time-of-use) sur les demandes de retrait
-- =============================================================================

-- RPC request_withdrawal
-- Garantit l'atomicité complète : vérification de solde + INSERT en une seule
-- transaction PostgreSQL, protégée par un advisory lock par utilisateur.
-- Appelée par WithdrawalService.processWithdrawal() via supabase.rpc()
-- =============================================================================

CREATE OR REPLACE FUNCTION request_withdrawal(
    p_user_id         UUID,
    p_gross_amount    NUMERIC,
    p_fee_rate        NUMERIC,
    p_fee_amount      NUMERIC,
    p_net_amount      NUMERIC,
    p_payment_details JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_available NUMERIC;
    v_total_pending   NUMERIC;
    v_real_available  NUMERIC;
    v_withdrawal      RECORD;
BEGIN
    -- Verrou consultatif transactionnel sur l'utilisateur.
    -- Deux appels simultanés pour le même user_id s'attendent mutuellement
    -- jusqu'à la fin de la transaction, éliminant la race condition TOCTOU.
    PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

    -- Calcul des commissions AVAILABLE en base (reflet du solde réel)
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_available
    FROM referral_commissions
    WHERE sponsor_id = p_user_id
      AND status = 'AVAILABLE';

    -- Soustraction des retraits en cours non encore resolus
    SELECT COALESCE(SUM(gross_amount), 0)
    INTO v_total_pending
    FROM withdrawals
    WHERE user_id = p_user_id
      AND status IN ('PENDING', 'PROCESSING');

    v_real_available := v_total_available - v_total_pending;

    IF v_real_available < p_gross_amount THEN
        RAISE EXCEPTION 'INSUFFICIENT_BALANCE:Solde disponible : % FCFA — Montant demandé : % FCFA',
            v_real_available, p_gross_amount
        USING ERRCODE = 'P0001';
    END IF;

    -- Création atomique de l'enregistrement de retrait dans la même transaction
    INSERT INTO withdrawals (
        user_id,
        gross_amount,
        fee_rate,
        fee_amount,
        net_amount,
        withdrawal_method,
        payment_details,
        status
    )
    VALUES (
        p_user_id,
        p_gross_amount,
        p_fee_rate,
        p_fee_amount,
        p_net_amount,
        'MOBILE_MONEY',
        p_payment_details,
        'PROCESSING'
    )
    RETURNING * INTO v_withdrawal;

    RETURN jsonb_build_object(
        'id',              v_withdrawal.id,
        'user_id',         v_withdrawal.user_id,
        'gross_amount',    v_withdrawal.gross_amount,
        'fee_amount',      v_withdrawal.fee_amount,
        'net_amount',      v_withdrawal.net_amount,
        'fee_rate',        v_withdrawal.fee_rate,
        'status',          v_withdrawal.status,
        'payment_details', v_withdrawal.payment_details,
        'created_at',      v_withdrawal.created_at
    );
END;
$$;

-- Accès restreint au service_role (le backend Next.js uniquement)
GRANT EXECUTE ON FUNCTION request_withdrawal(UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB)
    TO service_role;

REVOKE EXECUTE ON FUNCTION request_withdrawal(UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB)
    FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION request_withdrawal IS
    'RPC atomique pour la création sécurisée d''un retrait. '
    'Utilise pg_advisory_xact_lock pour prévenir la double-dépense concurrente. '
    'Lève INSUFFICIENT_BALANCE si le solde réel est insuffisant.';
