-- ============================================================================
-- EVENT VILLAGE — LOT 3 : commissions de parrainage et régularisation (3.5)
-- ============================================================================
--  - Commissions créées EN ATTENTE (PENDING) avec available_at = confirmation + délai réglé
--    (finance.referral_availability_days, 7 à 14 jours, CDC §102), créditées au grand livre
--    PARRAINAGE à cette date ; referral_commissions_release les rend AVAILABLE (cron).
--  - Base : revenu net Event Village du paiement ; montant arrondi au centime ; taux historisés
--    sur la relation (N2 : taux de la relation N1, choix existant conservé).
--  - Remboursement (total ou partiel) : commission non versée annulée (CANCELLED + motif) ou
--    recalculée au prorata (nouvelle ligne) ; commission déjà versée, même en partie : ligne de
--    REGULARISATION négative, débitée du solde (créance sur les gains futurs au-delà, CDC §103).
--    Aucune suppression : l'historique est conservé.
--  - Versements : allocation FIFO des commissions aux retraits (referral_commission_payouts) ;
--    une commission est PAID quand elle est entièrement couverte.
--  - referral_config aligné sur le CDC (§95 à §97, Annexe A).
--  - La politique referral_relationships_insert est supprimée : seule l'inscription (serveur)
--    crée une relation ; un client ne peut plus se choisir un parrain ni des taux.
-- ============================================================================

-- ── Colonnes ────────────────────────────────────────────────────────────────
ALTER TABLE public.referral_commissions ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'COMMISSION' CHECK (kind IN ('COMMISSION', 'REGULARISATION'));
ALTER TABLE public.referral_commissions ADD COLUMN IF NOT EXISTS regularizes_id UUID REFERENCES public.referral_commissions(id) ON DELETE RESTRICT;
ALTER TABLE public.referral_commissions ADD COLUMN IF NOT EXISTS replaces_id UUID REFERENCES public.referral_commissions(id) ON DELETE RESTRICT;
ALTER TABLE public.referral_commissions ADD COLUMN IF NOT EXISTS refund_id UUID REFERENCES public.refunds(id) ON DELETE RESTRICT;
ALTER TABLE public.referral_commissions ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0);
ALTER TABLE public.referral_commissions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE public.referral_commissions DROP CONSTRAINT IF EXISTS referral_commissions_amount_check;
ALTER TABLE public.referral_commissions DROP CONSTRAINT IF EXISTS referral_commissions_amount_sign;
ALTER TABLE public.referral_commissions ADD CONSTRAINT referral_commissions_amount_sign
    CHECK ((kind = 'COMMISSION' AND amount >= 0) OR (kind = 'REGULARISATION' AND amount < 0));
CREATE INDEX IF NOT EXISTS idx_referral_commissions_payment ON public.referral_commissions (payment_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_sponsor ON public.referral_commissions (sponsor_id, status, available_at);

CREATE TABLE IF NOT EXISTS public.referral_commission_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commission_id UUID NOT NULL REFERENCES public.referral_commissions(id) ON DELETE RESTRICT,
    withdrawal_id UUID NOT NULL REFERENCES public.withdrawals(id) ON DELETE RESTRICT,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    reversed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_referral_commission_payout UNIQUE (commission_id, withdrawal_id)
);
ALTER TABLE public.referral_commission_payouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.referral_commission_payouts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.referral_commission_payouts TO service_role;

-- ── Grille du CDC ───────────────────────────────────────────────────────────
INSERT INTO public.referral_config (sponsor_status, referral_type, rate_n1, rate_n2, duration_months, is_active) VALUES
    ('STANDARD', 'CLIENT_TO_CLIENT', 5.00, 2.00, 12, TRUE),
    ('STANDARD', 'CLIENT_TO_PRESTATAIRE', 7.00, 2.00, 24, TRUE),
    ('AMBASSADEUR', 'CLIENT_TO_CLIENT', 7.00, 2.00, 24, TRUE),
    ('AMBASSADEUR', 'CLIENT_TO_PRESTATAIRE', 10.00, 3.00, 36, TRUE)
ON CONFLICT (sponsor_status, referral_type) DO UPDATE
   SET rate_n1 = EXCLUDED.rate_n1, rate_n2 = EXCLUDED.rate_n2, duration_months = EXCLUDED.duration_months,
       is_active = TRUE, updated_at = now();

-- ── Relations : plus d'insertion directe par un client ──────────────────────
DROP POLICY IF EXISTS "referral_relationships_insert" ON public.referral_relationships;

-- ── Calcul (à la confirmation, trigger existant trg_payment_success_referrals) ─
CREATE OR REPLACE FUNCTION public.calculate_referral_commissions(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payment record;
    v_rel_n1 record;
    v_rel_n2 record;
    v_available timestamptz;
    v_amount numeric;
    v_id uuid;
BEGIN
    SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'calculate_referral_commissions : paiement % introuvable', p_payment_id;
    END IF;
    IF v_payment.status <> 'SUCCESS' OR NOT v_payment.is_platform_payment THEN
        RETURN;
    END IF;
    IF v_payment.net_event_village_revenue IS NULL OR v_payment.net_event_village_revenue <= 0 THEN
        RETURN;
    END IF;
    SELECT * INTO v_rel_n1 FROM public.referral_relationships
     WHERE referred_id = v_payment.client_id AND is_active = TRUE AND expires_at >= now();
    IF NOT FOUND THEN
        RETURN;
    END IF;
    v_available := now() + make_interval(days => public.fin_setting_num('finance.referral_availability_days')::int);

    v_amount := public.fin_round_2(v_payment.net_event_village_revenue * v_rel_n1.rate_n1_at_creation / 100);
    IF v_amount > 0 THEN
        INSERT INTO public.referral_commissions (sponsor_id, referred_id, generation, referral_type, payment_id, eligible_net_revenue,
                                                 commission_rate, amount, status, idempotency_key, available_at, kind)
        VALUES (v_rel_n1.sponsor_id, v_payment.client_id, 'N1', v_rel_n1.referral_type, v_payment.id, v_payment.net_event_village_revenue,
                v_rel_n1.rate_n1_at_creation, v_amount, 'PENDING', 'COMM_N1_' || v_payment.id || '_' || v_rel_n1.sponsor_id, v_available, 'COMMISSION')
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id INTO v_id;
        IF v_id IS NOT NULL THEN
            PERFORM public.fin_ledger_credit(v_rel_n1.sponsor_id, 'PARRAINAGE', NULL, 'COMMISSION', v_amount, v_available,
                                             jsonb_build_object('payment_id', v_payment.id, 'commission_id', v_id),
                                             'COMM-' || v_id::text, 'Commission de parrainage N1');
        END IF;
    END IF;

    SELECT * INTO v_rel_n2 FROM public.referral_relationships
     WHERE referred_id = v_rel_n1.sponsor_id AND is_active = TRUE AND expires_at >= now();
    IF NOT FOUND THEN
        RETURN;
    END IF;
    v_id := NULL;
    v_amount := public.fin_round_2(v_payment.net_event_village_revenue * v_rel_n1.rate_n2_at_creation / 100);
    IF v_amount > 0 THEN
        INSERT INTO public.referral_commissions (sponsor_id, referred_id, generation, referral_type, payment_id, eligible_net_revenue,
                                                 commission_rate, amount, status, idempotency_key, available_at, kind)
        VALUES (v_rel_n2.sponsor_id, v_payment.client_id, 'N2', v_rel_n1.referral_type, v_payment.id, v_payment.net_event_village_revenue,
                v_rel_n1.rate_n2_at_creation, v_amount, 'PENDING', 'COMM_N2_' || v_payment.id || '_' || v_rel_n2.sponsor_id, v_available, 'COMMISSION')
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id INTO v_id;
        IF v_id IS NOT NULL THEN
            PERFORM public.fin_ledger_credit(v_rel_n2.sponsor_id, 'PARRAINAGE', NULL, 'COMMISSION', v_amount, v_available,
                                             jsonb_build_object('payment_id', v_payment.id, 'commission_id', v_id),
                                             'COMM-' || v_id::text, 'Commission de parrainage N2');
        END IF;
    END IF;
END;
$$;

-- ── Disponibilité (cron) ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.referral_commissions_release()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    UPDATE public.referral_commissions
       SET status = 'AVAILABLE', updated_at = now()
     WHERE kind = 'COMMISSION' AND status = 'PENDING' AND available_at <= now();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN jsonb_build_object('released', v_count);
END;
$$;

-- ── Remboursement : annulation, prorata ou régularisation ───────────────────
CREATE OR REPLACE FUNCTION public.fin_referral_on_refund(p_payment_id uuid, p_refund_id uuid, p_prev_refunded numeric, p_new_refunded numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total numeric;
    c record;
    v_eff numeric;
    v_new numeric;
    v_id uuid;
BEGIN
    SELECT amount INTO v_total FROM public.payments WHERE id = p_payment_id;
    IF v_total IS NULL OR v_total <= 0 OR p_new_refunded <= p_prev_refunded THEN
        RETURN;
    END IF;
    FOR c IN
        SELECT * FROM public.referral_commissions
         WHERE payment_id = p_payment_id AND kind = 'COMMISSION' AND status <> 'CANCELLED'
         ORDER BY generation, id FOR UPDATE
    LOOP
        v_eff := c.amount + COALESCE((SELECT sum(amount) FROM public.referral_commissions WHERE regularizes_id = c.id), 0);
        CONTINUE WHEN v_eff <= 0;
        v_new := CASE WHEN p_new_refunded >= v_total THEN 0
                      ELSE public.fin_round_2(v_eff * (v_total - p_new_refunded) / (v_total - p_prev_refunded)) END;
        CONTINUE WHEN v_new >= v_eff;

        IF c.paid_amount = 0 AND c.status IN ('PENDING', 'AVAILABLE')
           AND NOT EXISTS (SELECT 1 FROM public.referral_commissions WHERE regularizes_id = c.id) THEN
            -- Jamais versée : annulée, et remplacée au prorata pour un remboursement partiel
            UPDATE public.referral_commissions
               SET status = 'CANCELLED', cancelled_at = now(), refund_id = p_refund_id, updated_at = now(),
                   cancellation_reason = CASE WHEN v_new = 0 THEN 'REMBOURSEMENT' ELSE 'RECALCUL_PRORATA' END
             WHERE id = c.id;
            PERFORM public.fin_ledger_debit(c.sponsor_id, 'PARRAINAGE', NULL, 'COMMISSION_ANNULEE', c.amount, GREATEST(now(), c.available_at),
                                            jsonb_build_object('payment_id', p_payment_id, 'commission_id', c.id, 'refund_id', p_refund_id),
                                            'COMM-ANN-' || c.id::text, 'Commission annulée : remboursement du filleul');
            IF v_new > 0 THEN
                INSERT INTO public.referral_commissions (sponsor_id, referred_id, generation, referral_type, payment_id, eligible_net_revenue,
                                                         commission_rate, amount, status, idempotency_key, available_at, kind, replaces_id, refund_id)
                VALUES (c.sponsor_id, c.referred_id, c.generation, c.referral_type, c.payment_id, c.eligible_net_revenue,
                        c.commission_rate, v_new, c.status, c.idempotency_key || '-R-' || p_refund_id::text, c.available_at,
                        'COMMISSION', c.id, p_refund_id)
                RETURNING id INTO v_id;
                PERFORM public.fin_ledger_credit(c.sponsor_id, 'PARRAINAGE', NULL, 'COMMISSION', v_new, c.available_at,
                                                 jsonb_build_object('payment_id', p_payment_id, 'commission_id', v_id),
                                                 'COMM-' || v_id::text, 'Commission recalculée au prorata du remboursement');
            END IF;
        ELSE
            -- Déjà versée (même en partie) : régularisation négative, déduite des gains futurs
            INSERT INTO public.referral_commissions (sponsor_id, referred_id, generation, referral_type, payment_id, eligible_net_revenue,
                                                     commission_rate, amount, status, idempotency_key, available_at, kind, regularizes_id, refund_id)
            VALUES (c.sponsor_id, c.referred_id, c.generation, c.referral_type, c.payment_id, c.eligible_net_revenue,
                    c.commission_rate, v_new - v_eff, 'AVAILABLE', 'REGUL-' || c.id::text || '-' || p_refund_id::text, now(),
                    'REGULARISATION', c.id, p_refund_id)
            RETURNING id INTO v_id;
            PERFORM public.fin_ledger_debit(c.sponsor_id, 'PARRAINAGE', NULL, 'REGULARISATION', v_eff - v_new, now(),
                                            jsonb_build_object('payment_id', p_payment_id, 'commission_id', v_id, 'refund_id', p_refund_id),
                                            'REGUL-' || v_id::text, 'Régularisation : commission déjà versée, remboursement du filleul');
        END IF;
    END LOOP;
END;
$$;

-- ── Allocation FIFO des commissions à un retrait de parrainage ──────────────
CREATE OR REPLACE FUNCTION public.fin_referral_allocate(p_user uuid, p_withdrawal_id uuid, p_amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_left numeric := p_amount;
    c record;
    v_effective numeric;
    v_rest numeric;
    v_take numeric;
BEGIN
    FOR c IN
        SELECT rc.* FROM public.referral_commissions rc
         WHERE rc.sponsor_id = p_user AND rc.kind = 'COMMISSION' AND rc.status IN ('PENDING', 'AVAILABLE')
           AND rc.available_at <= now()
         ORDER BY rc.available_at, rc.created_at, rc.id
         FOR UPDATE
    LOOP
        EXIT WHEN v_left <= 0;
        v_effective := c.amount + COALESCE((SELECT sum(g.amount) FROM public.referral_commissions g WHERE g.regularizes_id = c.id), 0);
        v_rest := v_effective - c.paid_amount;
        CONTINUE WHEN v_rest <= 0;
        v_take := LEAST(v_left, v_rest);
        INSERT INTO public.referral_commission_payouts (commission_id, withdrawal_id, amount) VALUES (c.id, p_withdrawal_id, v_take);
        UPDATE public.referral_commissions
           SET paid_amount = paid_amount + v_take,
               status = CASE WHEN paid_amount + v_take >= v_effective THEN 'PAID'::commission_status_enum ELSE 'AVAILABLE'::commission_status_enum END,
               paid_at = CASE WHEN paid_amount + v_take >= v_effective THEN now() ELSE paid_at END,
               updated_at = now()
         WHERE id = c.id;
        v_left := v_left - v_take;
    END LOOP;
    RETURN p_amount - v_left;
END;
$$;

-- Retrait refusé : allocations annulées (lignes conservées, marquées reversed_at)
CREATE OR REPLACE FUNCTION public.fin_referral_unallocate(p_withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    a record;
BEGIN
    FOR a IN SELECT * FROM public.referral_commission_payouts WHERE withdrawal_id = p_withdrawal_id AND reversed_at IS NULL FOR UPDATE LOOP
        UPDATE public.referral_commission_payouts SET reversed_at = now() WHERE id = a.id;
        UPDATE public.referral_commissions
           SET paid_amount = GREATEST(paid_amount - a.amount, 0),
               status = CASE WHEN status = 'PAID' THEN 'AVAILABLE'::commission_status_enum ELSE status END,
               paid_at = NULL,
               updated_at = now()
         WHERE id = a.commission_id;
    END LOOP;
END;
$$;

-- Privilèges : service_role uniquement
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.calculate_referral_commissions(uuid)',
        'public.referral_commissions_release()',
        'public.fin_referral_on_refund(uuid, uuid, numeric, numeric)',
        'public.fin_referral_allocate(uuid, uuid, numeric)',
        'public.fin_referral_unallocate(uuid)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
